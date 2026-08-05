import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./api-client";

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        // Redirect to login handled by auth store
        break;
      case 403:
        toast.error("You don't have permission to perform this action");
        break;
      case 404:
        toast.error("Resource not found");
        break;
      case 429:
        toast.error("Too many requests. Please try again later.");
        break;
      default:
        toast.error(error.message || "Something went wrong");
    }
  } else {
    toast.error("An unexpected error occurred");
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleError,
  }),
  mutationCache: new MutationCache({
    onError: handleError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
