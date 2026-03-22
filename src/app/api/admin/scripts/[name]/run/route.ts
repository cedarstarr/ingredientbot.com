import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.isAdmin !== true) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await params

  // Sanitize: only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid script name' }, { status: 400 })
  }

  const scriptPath = path.join(process.cwd(), 'scripts', `${name}.ts`)
  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 })
  }

  const userId = session.user.id as string
  const startTime = Date.now()

  try {
    const { stdout, stderr } = await execAsync(
      `npx tsx "${scriptPath}"`,
      {
        cwd: process.cwd(),
        timeout: 60000,
        env: { ...process.env },
      }
    )

    // Scripts can emit ROWS_AFFECTED:{...} in stdout to report counts
    let rowsAffected = { inserted: 0, updated: 0, deleted: 0 }
    const match = stdout.match(/ROWS_AFFECTED:(\{[^}]+\})/)
    if (match) {
      try {
        rowsAffected = JSON.parse(match[1])
      } catch {
        // ignore parse errors
      }
    }

    await prisma.adminScriptLog.create({
      data: {
        scriptName: name,
        ranByUserId: userId,
        rowsAffected,
        status: 'success',
      },
    })

    return NextResponse.json({
      success: true,
      stdout: stdout.slice(0, 2000),
      stderr: stderr.slice(0, 500),
      duration: Date.now() - startTime,
    })
  } catch (error: unknown) {
    const errorMessage =
      (error as { message?: string }).message ?? String(error)

    await prisma.adminScriptLog.create({
      data: {
        scriptName: name,
        ranByUserId: userId,
        rowsAffected: { inserted: 0, updated: 0, deleted: 0 },
        status: 'error',
        errorMessage: errorMessage.slice(0, 500),
      },
    })

    return NextResponse.json(
      { error: errorMessage.slice(0, 500) },
      { status: 500 }
    )
  }
}
