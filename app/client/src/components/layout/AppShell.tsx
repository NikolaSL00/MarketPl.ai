import { useState } from "react"
import { NavLink } from "react-router"
import { Upload, Database, LineChart, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Header } from "./Header"

const navItems = [
  { to: "/import", label: "Import", icon: Upload },
  { to: "/data", label: "Data Explorer", icon: Database },
  { to: "/backtest", label: "Backtest", icon: LineChart },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-in-out",
          expanded ? "w-[200px]" : "w-14"
        )}
      >
        {/* Logo */}
        <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-3">
          <span className="text-base font-bold text-[var(--accent)] shrink-0">m</span>
          {expanded && (
            <span className="text-sm font-bold text-[var(--accent)] whitespace-nowrap overflow-hidden">
              marketPl.ai
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[var(--radius)] px-2.5 py-2 text-sm transition-colors",
                  "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)] border-l-2 border-[var(--accent)]"
                    : "text-[var(--foreground-muted)]"
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              {expanded && (
                <span className="whitespace-nowrap overflow-hidden">{label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex h-10 items-center justify-center border-t border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
