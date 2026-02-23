import { useLocation } from "react-router"

const pageTitles: Record<string, string> = {
  "/import": "Import",
  "/data": "Data Explorer",
}

export function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? "marketPl.ai"

  return (
    <header className="flex h-12 items-center border-b border-[var(--border)] bg-[var(--surface)] px-6">
      <h1 className="text-sm font-semibold text-[var(--foreground)]">{title}</h1>
    </header>
  )
}
