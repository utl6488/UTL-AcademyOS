import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenants } from "@/features/admin/api/queries";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";

export function TenantSwitcher() {
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedId = useTenantContextStore((s) => s.impersonatedTenantId);
  const impersonatedName = useTenantContextStore((s) => s.impersonatedTenantName);
  const setImpersonated = useTenantContextStore((s) => s.setImpersonated);
  const queryClient = useQueryClient();

  const isSuperAdmin = role === "SUPER_ADMIN";
  const { data } = useTenants({ pageSize: 100 }, { enabled: isSuperAdmin });
  const tenants = data?.data ?? [];

  if (!isSuperAdmin) return null;

  function select(id: string | null, name: string | null) {
    setImpersonated(id, name);
    // Every query is now scoped differently; refetch everything.
    queryClient.invalidateQueries();
  }

  const label = impersonatedName ?? "All tenants";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "hidden gap-2 md:inline-flex",
            impersonatedId && "border-warning text-warning-foreground"
          )}
        >
          {impersonatedId ? <Building2 className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          <span className="max-w-[160px] truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>View as tenant</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => select(null, null)}>
          <Globe className="mr-2 h-4 w-4" />
          <span className="flex-1">All tenants (bypass)</span>
          {!impersonatedId && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {tenants.length === 0 && <DropdownMenuItem disabled>No tenants</DropdownMenuItem>}
        {tenants.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => select(t.id, t.name)}>
            <Building2 className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{t.name}</span>
            {impersonatedId === t.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
