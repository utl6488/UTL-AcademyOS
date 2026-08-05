import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

/**
 * Optimized image component with lazy loading and skeleton fallback.
 * Always renders with explicit width/height to prevent layout shift.
 */
export function LazyImage({ className, fallback, alt, ...props }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return fallback ? <>{fallback}</> : <Skeleton className={className} />;
  }

  return (
    <div className={cn("relative", className)}>
      {!loaded && <Skeleton className="absolute inset-0" />}
      <img
        {...props}
        alt={alt || ""}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn("transition-opacity", loaded ? "opacity-100" : "opacity-0", className)}
      />
    </div>
  );
}
