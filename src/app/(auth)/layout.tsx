import { ChefHat } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="main-content" className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo at top */}
      <div className="mb-8 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChefHat className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">Robot Food</span>
        </Link>
      </div>

      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
