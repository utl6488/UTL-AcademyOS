import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas/auth-schemas";
import { useResetPasswordMutation } from "../api/mutations";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { mutate: resetPassword, isPending } = useResetPasswordMutation();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  // If no token, redirect to forgot password
  if (!token) {
    return <Navigate to="/auth/forgot-password" replace />;
  }

  function onSubmit(data: ResetPasswordFormValues) {
    resetPassword({ ...data, token: token! });
  }

  return (
    <Card>
      <CardHeader className="items-center space-y-2 text-center">
        <Logo showName className="h-16 w-auto" />
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className={errors.password ? "text-destructive" : undefined}>
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive" role="alert">
                {errors.password.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Min 8 chars with uppercase, lowercase, and number
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className={errors.confirmPassword ? "text-destructive" : undefined}
            >
              Confirm New Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={isPending}>
            Reset password
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/auth/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
