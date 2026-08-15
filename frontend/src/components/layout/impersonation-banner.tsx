import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTenantContextStore } from "@/store/tenant-context-store";

export function ImpersonationBanner() {
  const impersonatedName = useTenantContextStore((s) => s.impersonatedTenantName);
  const setImpersonated = useTenantContextStore((s) => s.setImpersonated);
  const queryClient = useQueryClient();

  if (!impersonatedName) return null;

  function stop() {
    setImpersonated(null, null);
    queryClient.invalidateQueries();
  }

  return (
    <div className="flex items-center gap-3 border-b bg-warning/15 px-4 py-2 text-sm text-warning-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Viewing tenant <strong>{impersonatedName}</strong> as super admin. All reads and writes are
        scoped to this tenant.
      </span>
      <Button variant="ghost" size="sm" onClick={stop} className="h-7 gap-1">
        <X className="h-3 w-3" /> Exit
      </Button>
    </div>
  );
}
