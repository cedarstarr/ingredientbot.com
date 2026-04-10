// Cooking mode uses a full-screen layout — overrides the sidebar nav with a
// fixed overlay so the user gets an unobstructed step-by-step experience.
export default function CookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {children}
    </div>
  )
}
