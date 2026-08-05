import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthLayout } from "@/layouts/AuthLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ExamLayout } from "@/layouts/ExamLayout";
import { ErrorBoundaryPage } from "@/components/feedback/error-boundary-page";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";

// Auth pages
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const SignupPage = lazy(() => import("@/features/auth/pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("@/features/auth/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("@/features/auth/pages/VerifyEmailPage"));
const SessionsPage = lazy(() => import("@/features/auth/pages/SessionsPage"));

// Dashboard
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));

// Institute
const InstituteProfilePage = lazy(() => import("@/features/institute/pages/InstituteProfilePage"));

// Org
const BranchesPage = lazy(() => import("@/features/org/pages/BranchesPage"));
const ClassesPage = lazy(() => import("@/features/org/pages/ClassesPage"));
const BatchesPage = lazy(() => import("@/features/org/pages/BatchesPage"));
const SubjectsPage = lazy(() => import("@/features/org/pages/SubjectsPage"));
const TopicsPage = lazy(() => import("@/features/org/pages/TopicsPage"));

// Users
const TeachersPage = lazy(() => import("@/features/users/pages/TeachersPage"));
const StudentsPage = lazy(() => import("@/features/users/pages/StudentsPage"));
const BulkImportPage = lazy(() => import("@/features/users/pages/BulkImportPage"));

// Question Bank
const QuestionListPage = lazy(() => import("@/features/question-bank/pages/QuestionListPage"));
const QuestionEditorPage = lazy(() => import("@/features/question-bank/pages/QuestionEditorPage"));

// Exam Authoring
const ExamListPage = lazy(() => import("@/features/exam-authoring/pages/ExamListPage"));
const ExamBuilderPage = lazy(() => import("@/features/exam-authoring/pages/ExamBuilderPage"));
const LiveConsolePage = lazy(() => import("@/features/exam-authoring/pages/LiveConsolePage"));

// Grading
const GradingQueuePage = lazy(() => import("@/features/grading/pages/GradingQueuePage"));
const GradingViewerPage = lazy(() => import("@/features/grading/pages/GradingViewerPage"));

// Results & Analytics
const StudentResultPage = lazy(() => import("@/features/results/pages/StudentResultPage"));
const LeaderboardPage = lazy(() => import("@/features/results/pages/LeaderboardPage"));
const ClassReportPage = lazy(() => import("@/features/results/pages/ClassReportPage"));
const InstituteDashboardPage = lazy(
  () => import("@/features/results/pages/InstituteDashboardPage")
);

// AI
const StudentAiPage = lazy(() => import("@/features/ai/pages/StudentAiPage"));
const TeacherAiPage = lazy(() => import("@/features/ai/pages/TeacherAiPage"));

// Billing
const PricingPage = lazy(() => import("@/features/billing/pages/PricingPage"));
const BillingDashboardPage = lazy(() => import("@/features/billing/pages/BillingDashboardPage"));

// Notifications & Settings
const NotificationsPage = lazy(() => import("@/features/notifications/pages/NotificationsPage"));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"));

// Admin
const TenantsListPage = lazy(() => import("@/features/admin/pages/TenantsListPage"));
const TenantDetailPage = lazy(() => import("@/features/admin/pages/TenantDetailPage"));
const RevenueDashboardPage = lazy(() => import("@/features/admin/pages/RevenueDashboardPage"));
const FeatureFlagsPage = lazy(() => import("@/features/admin/pages/FeatureFlagsPage"));
const SystemHealthPage = lazy(() => import("@/features/admin/pages/SystemHealthPage"));

// Error pages
const NotFoundPage = lazy(() => import("@/routes/NotFoundPage"));
const ForbiddenPage = lazy(() => import("@/routes/ForbiddenPage"));

// eslint-disable-next-line react-refresh/only-export-components -- router tree lives beside its Suspense helper
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSkeleton variant="page" />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  // Public auth routes
  {
    path: "/auth",
    element: <AuthLayout />,
    errorElement: <ErrorBoundaryPage />,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      {
        path: "login",
        element: (
          <SuspenseWrapper>
            <LoginPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "signup",
        element: (
          <SuspenseWrapper>
            <SignupPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <SuspenseWrapper>
            <ForgotPasswordPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "reset-password",
        element: (
          <SuspenseWrapper>
            <ResetPasswordPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "verify",
        element: (
          <SuspenseWrapper>
            <VerifyEmailPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  // Protected dashboard routes
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundaryPage />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      // Institute
      {
        path: "institute",
        element: (
          <SuspenseWrapper>
            <InstituteProfilePage />
          </SuspenseWrapper>
        ),
      },
      // Org
      {
        path: "org",
        element: (
          <SuspenseWrapper>
            <BranchesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "org/branches",
        element: (
          <SuspenseWrapper>
            <BranchesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "org/classes",
        element: (
          <SuspenseWrapper>
            <ClassesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "org/batches",
        element: (
          <SuspenseWrapper>
            <BatchesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "org/subjects",
        element: (
          <SuspenseWrapper>
            <SubjectsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "org/subjects/:subjectId/topics",
        element: (
          <SuspenseWrapper>
            <TopicsPage />
          </SuspenseWrapper>
        ),
      },
      // Users
      {
        path: "users",
        element: (
          <SuspenseWrapper>
            <TeachersPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "users/teachers",
        element: (
          <SuspenseWrapper>
            <TeachersPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "users/students",
        element: (
          <SuspenseWrapper>
            <StudentsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "users/import",
        element: (
          <SuspenseWrapper>
            <BulkImportPage />
          </SuspenseWrapper>
        ),
      },
      // Placeholder routes for future phases
      {
        path: "questions",
        element: (
          <SuspenseWrapper>
            <QuestionListPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "questions/new",
        element: (
          <SuspenseWrapper>
            <QuestionEditorPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "questions/:id",
        element: (
          <SuspenseWrapper>
            <QuestionEditorPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "exams",
        element: (
          <SuspenseWrapper>
            <ExamListPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "exams/new",
        element: (
          <SuspenseWrapper>
            <ExamBuilderPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "exams/:id",
        element: (
          <SuspenseWrapper>
            <ExamBuilderPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "exams/:id/live-console",
        element: (
          <SuspenseWrapper>
            <LiveConsolePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "results",
        element: (
          <SuspenseWrapper>
            <StudentResultPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "results/:attemptId",
        element: (
          <SuspenseWrapper>
            <StudentResultPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "results/:examId/leaderboard",
        element: (
          <SuspenseWrapper>
            <LeaderboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "results/:examId/class-report",
        element: (
          <SuspenseWrapper>
            <ClassReportPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "analytics",
        element: (
          <SuspenseWrapper>
            <InstituteDashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "ai",
        element: (
          <SuspenseWrapper>
            <StudentAiPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "ai/teacher",
        element: (
          <SuspenseWrapper>
            <TeacherAiPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "billing",
        element: (
          <SuspenseWrapper>
            <BillingDashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "billing/pricing",
        element: (
          <SuspenseWrapper>
            <PricingPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "settings",
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "settings/sessions",
        element: (
          <SuspenseWrapper>
            <SessionsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "notifications",
        element: (
          <SuspenseWrapper>
            <NotificationsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "grading",
        element: (
          <SuspenseWrapper>
            <GradingQueuePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "grading/:examId",
        element: (
          <SuspenseWrapper>
            <GradingViewerPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <TenantsListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "tenants",
            element: (
              <SuspenseWrapper>
                <TenantsListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "tenants/:id",
            element: (
              <SuspenseWrapper>
                <TenantDetailPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "revenue",
            element: (
              <SuspenseWrapper>
                <RevenueDashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "feature-flags",
            element: (
              <SuspenseWrapper>
                <FeatureFlagsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "health",
            element: (
              <SuspenseWrapper>
                <SystemHealthPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
    ],
  },
  // Fullscreen exam attempt
  {
    path: "/exam/:id/attempt",
    element: (
      <ProtectedRoute requiredRole="STUDENT">
        <ExamLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundaryPage />,
  },
  // Error pages
  {
    path: "/403",
    element: (
      <SuspenseWrapper>
        <ForbiddenPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: "/500",
    element: <ErrorBoundaryPage />,
  },
  {
    path: "*",
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
]);
