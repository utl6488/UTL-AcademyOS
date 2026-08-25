import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";

export default function SettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "STUDENT";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {!isStudent && <TabsTrigger value="preferences">Preferences</TabsTrigger>}
          {!isStudent && <TabsTrigger value="tenant">Tenant Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>

        {!isStudent && (
          <TabsContent value="preferences" className="mt-6">
            <PreferencesTab />
          </TabsContent>
        )}

        {!isStudent && (
          <TabsContent value="tenant" className="mt-6">
            <TenantTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Profile Tab ────────────────────────────────────────────────────────────

function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const handleSave = () => {
    toast.success("Profile updated");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-medium">
            {name.charAt(0).toUpperCase() || "?"}
          </div>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Upload Photo
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Security Tab ───────────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    toast.success("Password changed successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleChangePassword}>Change Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Manage your active sessions and sign out from other devices.
          </p>
          <Button variant="outline" size="sm">
            View Active Sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Preferences Tab ────────────────────────────────────────────────────────

function PreferencesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Configure email and in-app notification preferences.
        </p>
        <div className="rounded-md border border-dashed p-4">
          <p className="text-sm italic text-muted-foreground">
            Notification preferences coming soon.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tenant Tab ─────────────────────────────────────────────────────────────

function TenantTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" placeholder="Your institute name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-logo">Logo URL</Label>
              <Input id="org-logo" placeholder="https://..." />
            </div>
          </div>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Branding
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Exam Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-duration">Default Duration (minutes)</Label>
              <Input id="default-duration" type="number" placeholder="60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-pass">Pass Percentage</Label>
              <Input id="default-pass" type="number" placeholder="40" />
            </div>
          </div>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Defaults
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Grading Scheme</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Configure the grading scale used across exams.
          </p>
          <div className="rounded-md border border-dashed p-4">
            <p className="text-sm italic text-muted-foreground">
              Grading scheme configuration coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
