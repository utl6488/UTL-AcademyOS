import { PageHeader } from "@/components/layout/page-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your activity."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Dashboard KPI cards will go here in future phases */}
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">Dashboard content (upcoming phases)</p>
        </div>
      </div>
    </div>
  );
}
