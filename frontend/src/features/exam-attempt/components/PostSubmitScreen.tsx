import { CheckCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface PostSubmitScreenProps {
  examTitle: string;
  score?: number;
  totalMarks?: number;
  showImmediateResult: boolean;
}

export function PostSubmitScreen({
  examTitle,
  score,
  totalMarks,
  showImmediateResult,
}: PostSubmitScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-6 py-12">
          <div className="flex justify-center">
            <div className="rounded-full bg-success/10 p-4">
              <CheckCircle className="h-12 w-12 text-success" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">Exam Submitted!</h2>
            <p className="mt-1 text-sm text-muted-foreground">{examTitle}</p>
          </div>

          {showImmediateResult && score !== undefined && totalMarks !== undefined ? (
            <div className="space-y-2">
              <p className="text-4xl font-bold text-primary">
                {score}/{totalMarks}
              </p>
              <p className="text-sm text-muted-foreground">
                {((score / totalMarks) * 100).toFixed(1)}%
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Results will be available after grading</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/results">View Results</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
