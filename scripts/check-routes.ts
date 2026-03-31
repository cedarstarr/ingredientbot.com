/**
 * @description Pre-build check: detect conflicting dynamic route segment names.
 * Next.js crashes at runtime (not build time) when two routes at the same URL
 * path use different [param] names (e.g. [id] vs [slug]). This catches it early.
 */

import { readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const APP_DIR = join(process.cwd(), 'src', 'app')

function stripNonUrlSegments(seg: string): string | null {
  if (seg.startsWith('(') && seg.endsWith(')')) return null
  if (seg.startsWith('@')) return null
  return seg
}

function toUrlPath(absPath: string): string {
  const rel = relative(APP_DIR, absPath)
  const parts = rel.split('/').map(stripNonUrlSegments).filter((s): s is string => s !== null)
  return '/' + parts.join('/')
}

function collectDynamicRoutes(dir: string): { urlPath: string; param: string; fsPath: string }[] {
  const results: { urlPath: string; param: string; fsPath: string }[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue

    if (entry.startsWith('[') && entry.endsWith(']') && !entry.startsWith('[...')) {
      const param = entry.slice(1, -1)
      const urlPath = toUrlPath(full)
      results.push({ urlPath, param, fsPath: full })
    }

    results.push(...collectDynamicRoutes(full))
  }

  return results
}

function main() {
  const routes = collectDynamicRoutes(APP_DIR)

  const byParent = new Map<string, typeof routes>()
  for (const route of routes) {
    const parts = route.urlPath.split('/')
    const parent = parts.slice(0, -1).join('/') || '/'
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push(route)
  }

  let conflicts = 0
  for (const [parent, group] of byParent) {
    const uniqueParams = [...new Set(group.map(r => r.param))]
    if (uniqueParams.length > 1) {
      console.error(`\n❌ Route conflict at URL path: ${parent}/[?]`)
      for (const r of group) {
        console.error(`   [${r.param}]  →  ${relative(process.cwd(), r.fsPath)}`)
      }
      conflicts++
    }
  }

  if (conflicts > 0) {
    console.error(`\n${conflicts} route conflict(s) found. Fix before deploying.\n`)
    process.exit(1)
  } else {
    console.log('✓ No dynamic route conflicts found.')
  }
}

main()
