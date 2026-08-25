import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteSchema, type AcceptInviteFormValues } from "../schemas/auth-schemas";
import { useAcceptInviteMutation } from "../api/mutations";

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { mutate: acceptInvite, isPending, isError, error } = useAcceptInviteMutation();

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  function onSubmit(data: AcceptInviteFormValues) {
    acceptInvite({ ...data, token: token! });
  }

  return (
    <Card>
      <CardHeader className="items-center space-y-2 text-center">
        <Logo showName className="h-16 w-auto" />
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>Set a password to activate your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className={errors.password ? "text-destructive" : undefined}>
              Password
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
              Confirm password
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

          {isError && (
            <p className="text-xs text-destructive" role="alert">
              {error instanceof Error ? error.message : "Could not accept invite"}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isPending}>
            Activate account
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
