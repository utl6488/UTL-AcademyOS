import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Branches", href: "/org/branches" },
  { label: "Classes", href: "/org/classes" },
  { label: "Batches", href: "/org/batches" },
];

export function OrgTabs() {
  return (
    <nav className="flex gap-1 border-b" aria-label="Organization sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.href}
          to={tab.href}
          end
          className={({ isActive }) =>
            cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
