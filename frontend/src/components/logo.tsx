import { cn } from "@/lib/utils";

export const APP_NAME = "UTL-AcademyOS";

interface LogoProps {
  className?: string;
  alt?: string;
  showName?: boolean;
  nameClassName?: string;
}

export function Logo({ className, alt = APP_NAME, showName = false, nameClassName }: LogoProps) {
  return (
    <span className="inline-flex flex-col items-center gap-2">
      <span className="inline-block">
        <img src="/logo-light.png" alt={alt} className={cn("block dark:hidden", className)} />
        <img src="/logo-dark.png" alt={alt} className={cn("hidden dark:block", className)} />
      </span>
      {showName && (
        <span className={cn("text-lg font-bold tracking-tight", nameClassName)}>{APP_NAME}</span>
      )}
    </span>
  );
}
