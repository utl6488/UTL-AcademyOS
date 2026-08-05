import { create } from "zustand";
import { api } from "./api-client";

interface FeatureFlagsState {
  flags: Record<string, boolean>;
  loaded: boolean;
  loadFlags: () => Promise<void>;
  isEnabled: (key: string) => boolean;
}

/**
 * Client-side feature flags store.
 * Flags are fetched from the backend on app init.
 * Backend is the source of truth — client only caches for UI gating.
 */
export const useFeatureFlags = create<FeatureFlagsState>((set, get) => ({
  flags: {},
  loaded: false,

  loadFlags: async () => {
    try {
      const flags = await api.get<Record<string, boolean>>("/feature-flags");
      set({ flags, loaded: true });
    } catch {
      // Fail silently — features default to disabled
      set({ loaded: true });
    }
  },

  isEnabled: (key: string) => {
    return get().flags[key] ?? false;
  },
}));

/**
 * React hook for checking a feature flag.
 */
export function useFeatureFlag(key: string): boolean {
  return useFeatureFlags((s) => s.flags[key] ?? false);
}
