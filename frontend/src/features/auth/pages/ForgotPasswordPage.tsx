import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../schemas/auth-schemas";
import { useForgotPasswordMutation } from "../api/mutations";

export default function ForgotPasswordPage() {
  const { mutate: forgotPassword, isPending, isSuccess } = useForgotPasswordMutation();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function onSubmit(data: ForgotPasswordFormValues) {
    forgotPassword(data);
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="items-center space-y-2 text-center">
          <Logo showName className="h-16 w-auto" />
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center">Check your email</CardTitle>
          <CardDescription className="text-center">
            We've sent a password reset link to your email address. Please check your inbox and
            follow the instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center space-y-2 text-center">
        <Logo showName className="h-16 w-auto" />
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your email and we'll send you a password reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className={errors.email ? "text-destructive" : undefined}>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={isPending}>
            Send reset link
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
