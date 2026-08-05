import { type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormTextareaProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
}

export function FormTextarea<T extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  description,
  className,
  disabled,
  required,
  rows = 4,
}: FormTextareaProps<T>) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} className={cn(error && "text-destructive")}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <textarea
        id={name}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-invalid={!!error}
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        {...register(name)}
      />
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error.message as string}
        </p>
      )}
    </div>
  );
}
