import { type ZodSchema, type ZodError } from "zod";
import { toast } from "sonner";

/**
 * Validates API response data against a Zod schema.
 * In development, shows a toast when the shape mismatches.
 * In production, logs a warning and returns data as-is.
 */
export function parseApiResponse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    if (import.meta.env.DEV) {
      const errors = formatZodErrors(result.error);
      console.warn("[API Response Validation] Shape mismatch:", errors);
      toast.warning("API response shape mismatch", {
        description: `Fields: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "..." : ""}`,
        duration: 5000,
      });
    }
    // Return data as-is in case of validation failure - don't break the app
    return data as T;
  }

  return result.data;
}

/**
 * Validates an array response from the API.
 */
export function parseApiArrayResponse<T>(schema: ZodSchema<T>, data: unknown[]): T[] {
  return data.map((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      if (import.meta.env.DEV) {
        console.warn(
          `[API Response Validation] Item ${index} shape mismatch:`,
          result.error.issues
        );
      }
      return item as T;
    }
    return result.data;
  });
}

/**
 * Creates a response parser for a specific schema.
 * Useful for composing with TanStack Query's select option.
 */
export function createResponseParser<T>(schema: ZodSchema<T>) {
  return (data: unknown): T => parseApiResponse(schema, data);
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
}
