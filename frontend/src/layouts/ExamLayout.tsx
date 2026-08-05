import { Suspense, lazy } from "react";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";

const ExamAttemptPage = lazy(() => import("@/features/exam-attempt/pages/ExamAttemptPage"));

export function ExamLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<LoadingSkeleton variant="page" />}>
        <ExamAttemptPage />
      </Suspense>
    </div>
  );
}
