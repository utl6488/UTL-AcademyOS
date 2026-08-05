import { create } from "zustand";

import type { User, Role } from "@/lib/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;

  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAllPermissions: (perms: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, isAuthenticated: false, isLoading: false }),

  hasRole: (role) => get().user?.role === role,
  hasAnyRole: (roles) => {
    const r = get().user?.role;
    return r ? roles.includes(r) : false;
  },
  hasPermission: (permission) => get().user?.permissions.includes(permission) ?? false,
  hasAllPermissions: (perms) => {
    const set = new Set(get().user?.permissions ?? []);
    return perms.every((p) => set.has(p));
  },
}));
