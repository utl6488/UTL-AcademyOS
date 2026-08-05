import { useEffect } from "react";
import { useSearchParams, Link, Navigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useVerifyEmailMutation } from "../api/mutations";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { mutate: verifyEmail, isPending, isSuccess, isError, error } = useVerifyEmailMutation();

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token, verifyEmail]);

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <CardTitle className="text-center">Verifying your email...</CardTitle>
          <CardDescription className="text-center">
            Please wait while we verify your email address.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-success/10 p-3">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </div>
          <CardTitle className="text-center">Email verified!</CardTitle>
          <CardDescription className="text-center">
            Your email has been verified successfully. You can now sign in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/auth/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-center">Verification failed</CardTitle>
          <CardDescription className="text-center">
            {(error as Error)?.message || "The verification link may have expired or is invalid."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
