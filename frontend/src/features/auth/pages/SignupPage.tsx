import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { useSignupMutation } from "../api/mutations";
import { signupSchema, type SignupFormValues } from "../schemas/auth-schemas";

export default function SignupPage() {
  const { mutate: signup, isPending } = useSignupMutation();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      instituteName: "",
      ownerName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function onSubmit(data: SignupFormValues) {
    signup(data);
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="items-center space-y-2 text-center">
        <Logo showName className="h-16 w-auto" />
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Register your institute to get started with UTL AcademyOS</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Institute info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Institute Details</h3>

            <div className="space-y-2">
              <Label htmlFor="instituteName">Institute Name *</Label>
              <Input
                id="instituteName"
                placeholder="Delhi Public School"
                aria-invalid={!!errors.instituteName}
                {...register("instituteName")}
              />
              {errors.instituteName && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.instituteName.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A URL slug is generated automatically from the institute name.
              </p>
            </div>
          </div>

          <Separator />

          {/* Owner info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Owner Account</h3>

            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner Name *</Label>
              <Input
                id="ownerName"
                placeholder="Jane Doe"
                autoComplete="name"
                aria-invalid={!!errors.ownerName}
                {...register("ownerName")}
              />
              {errors.ownerName && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.ownerName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="owner@institute.edu.in"
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

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
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
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
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
          </div>

          <Separator />

          {/* Terms */}
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                {...register("acceptTerms")}
              />
              <span className="text-sm text-muted-foreground">
                I agree to the{" "}
                <a href="/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-xs text-destructive" role="alert">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={isPending}>
            Create Account
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
