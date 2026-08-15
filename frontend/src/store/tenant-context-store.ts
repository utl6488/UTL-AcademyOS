import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TenantContextState {
  /** Set by SUPER_ADMIN to view a specific tenant's data. Otherwise null (bypass). */
  impersonatedTenantId: string | null;
  impersonatedTenantName: string | null;
  setImpersonated: (id: string | null, name: string | null) => void;
}

export const useTenantContextStore = create<TenantContextState>()(
  persist(
    (set) => ({
      impersonatedTenantId: null,
      impersonatedTenantName: null,
      setImpersonated: (id, name) =>
        set({ impersonatedTenantId: id, impersonatedTenantName: name }),
    }),
    { name: "utl:tenant-context" }
  )
);

/** Sync accessor for the api client (which can't call hooks). */
export function getImpersonatedTenantId(): string | null {
  return useTenantContextStore.getState().impersonatedTenantId;
}
