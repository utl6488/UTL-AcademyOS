import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Building2, Upload } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useInstituteProfile } from "../api/queries";
import { useUpdateInstituteMutation, useUploadLogoMutation } from "../api/mutations";
import {
  instituteProfileSchema,
  type InstituteProfileFormValues,
} from "../schemas/institute-schemas";

export default function InstituteProfilePage() {
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const { data: institute, isLoading, isError, refetch } = useInstituteProfile();

  // In god view there isn't a single "current institute" — send SUPER_ADMIN
  // to the full tenant list instead.
  if (isGodView) return <Navigate to="/admin/tenants" replace />;
  const { mutate: updateInstitute, isPending: isUpdating } = useUpdateInstituteMutation();
  const { mutate: uploadLogo, isPending: isUploading } = useUploadLogoMutation();

  const form = useForm<InstituteProfileFormValues>({
    resolver: zodResolver(instituteProfileSchema),
    defaultValues: {
      name: "",
      slug: "",
      timezone: "Asia/Kolkata",
      gradingScheme: "percentage",
      passingPercentage: 33,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (institute) {
      reset({
        name: institute.name,
        slug: institute.slug,
        logo: institute.logo || "",
        timezone: institute.timezone,
        address: institute.address || "",
        phone: institute.phone || "",
        email: institute.email || "",
        website: institute.website || "",
        brandColor: institute.brandColor || "",
        gradingScheme: institute.gradingScheme as "percentage" | "gpa" | "grade_letter",
        passingPercentage: institute.passingPercentage,
      });
    }
  }, [institute, reset]);

  function onSubmit(data: InstituteProfileFormValues) {
    updateInstitute(data);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  }

  if (isLoading) return <LoadingSkeleton variant="form" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institute Profile"
        description="Manage your institute's information and settings"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Logo & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <CardDescription>Your institute's public profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {institute?.logo ? (
                  <img src={institute.logo} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild loading={isUploading}>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </span>
                  </Button>
                </Label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG up to 2MB. Recommended 200x200px.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Institute Name *</Label>
                <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input id="slug" {...register("slug")} disabled />
                <p className="text-xs text-muted-foreground">Cannot be changed after creation</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register("address")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" type="url" placeholder="https://..." {...register("website")} />
              {errors.website && (
                <p className="text-xs text-destructive">{errors.website.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branding</CardTitle>
            <CardDescription>Customize the appearance for your institute</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brandColor">Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="brandColor"
                    placeholder="#3B82F6"
                    {...register("brandColor")}
                    className="flex-1"
                  />
                  <input
                    type="color"
                    value={form.watch("brandColor") || "#3B82F6"}
                    onChange={(e) => setValue("brandColor", e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-md border"
                  />
                </div>
                {errors.brandColor && (
                  <p className="text-xs text-destructive">{errors.brandColor.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone *</Label>
                <Input id="timezone" {...register("timezone")} />
                {errors.timezone && (
                  <p className="text-xs text-destructive">{errors.timezone.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grading Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grading Defaults</CardTitle>
            <CardDescription>Default grading configuration for exams</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Grading Scheme</Label>
                <Select
                  value={form.watch("gradingScheme")}
                  onValueChange={(v) =>
                    setValue("gradingScheme", v as "percentage" | "gpa" | "grade_letter")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="gpa">GPA</SelectItem>
                    <SelectItem value="grade_letter">Grade Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passingPercentage">Passing Percentage</Label>
                <Input
                  id="passingPercentage"
                  type="number"
                  min={0}
                  max={100}
                  {...register("passingPercentage", { valueAsNumber: true })}
                />
                {errors.passingPercentage && (
                  <p className="text-xs text-destructive">{errors.passingPercentage.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" loading={isUpdating}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
