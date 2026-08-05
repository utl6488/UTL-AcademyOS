import {
  BarChart3,
  Brain,
  Building2,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileQuestion,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Any role in this list grants visibility. Omit to allow everyone. */
  roles?: Role[];
}

const OWNER_ADMIN: Role[] = ["INSTITUTE_OWNER", "ADMIN"];
const OWNER_ADMIN_TEACHER: Role[] = ["INSTITUTE_OWNER", "ADMIN", "TEACHER"];

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Institute", href: "/institute", icon: Building2, roles: OWNER_ADMIN },
  { label: "Users", href: "/users", icon: Users, roles: OWNER_ADMIN_TEACHER },
  { label: "Organization", href: "/org", icon: FolderTree, roles: OWNER_ADMIN },
  {
    label: "Question Bank",
    href: "/questions",
    icon: FileQuestion,
    roles: OWNER_ADMIN_TEACHER,
  },
  { label: "Exams", href: "/exams", icon: ClipboardList },
  { label: "Results", href: "/results", icon: Trophy },
  { label: "Analytics", href: "/analytics", icon: BarChart3, roles: OWNER_ADMIN_TEACHER },
  { label: "AI Features", href: "/ai", icon: Brain },
];

const bottomNav: NavItem[] = [
  { label: "Billing", href: "/billing", icon: CreditCard, roles: OWNER_ADMIN },
  { label: "Grading", href: "/grading", icon: GraduationCap, roles: ["TEACHER"] },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/admin", icon: Shield, roles: ["SUPER_ADMIN"] },
];

export function Sidebar({ open, onToggle }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  function isVisible(item: NavItem) {
    if (!item.roles) return true;
    return user ? item.roles.includes(user.role) : false;
  }

  function isActive(href: string) {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r bg-sidebar transition-all duration-300",
        open ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        {open && (
          <Link to="/" className="text-lg font-bold text-sidebar-primary">
            UTL ExamPro
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !open && "rotate-180")} />
        </Button>
      </div>

      <Separator />

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {mainNav.filter(isVisible).map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {open && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* Bottom nav */}
      <nav className="space-y-1 p-2">
        {bottomNav.filter(isVisible).map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {open && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
