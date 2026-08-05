import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileDrop } from "@/components/forms/file-drop";
import {
  useUploadImportFileMutation,
  usePreviewImportMutation,
  useStartImportMutation,
} from "../api/mutations";
import { useImportJob } from "../api/queries";
import type { ImportPreview } from "../schemas/user-schemas";

type Step = "upload" | "preview" | "importing" | "complete";

export default function BulkImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const uploadMutation = useUploadImportFileMutation();
  const previewMutation = usePreviewImportMutation();
  const startMutation = useStartImportMutation();
  const { data: importJob } = useImportJob(jobId || "");

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) return;
    const key = await uploadMutation.mutateAsync(files[0]);
    setFileKey(key);
    const previewData = await previewMutation.mutateAsync(key);
    setPreview(previewData);
    setStep("preview");
  }

  async function handleStartImport() {
    if (!fileKey) return;
    const { jobId: id } = await startMutation.mutateAsync({ fileKey, role });
    setJobId(id);
    setStep("importing");
  }

  // Auto-advance to complete when job finishes
  if (
    importJob &&
    (importJob.status === "completed" || importJob.status === "failed") &&
    step === "importing"
  ) {
    setStep("complete");
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: "Bulk Import" }]} />

      <PageHeader
        title="Bulk Import Users"
        description="Upload a CSV file to import multiple users at once"
      />

      {/* Step: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file with columns: firstName, lastName, email, phone (optional), classId
              (for students)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Import as</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "student" | "teacher")}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FileDrop
              accept=".csv,.xlsx"
              maxSize={5 * 1024 * 1024}
              onFilesSelected={handleFilesSelected}
              label="Drop your CSV file here or click to browse"
              description="CSV or Excel file, max 5MB"
              disabled={uploadMutation.isPending || previewMutation.isPending}
            />

            {(uploadMutation.isPending || previewMutation.isPending) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploadMutation.isPending ? "Uploading..." : "Parsing file..."}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview Import</CardTitle>
              <CardDescription>
                {preview.totalRows} row(s) found · {preview.errors.length} error(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview.errors.length > 0 && (
                <Alert variant="warning" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Errors</AlertTitle>
                  <AlertDescription>
                    {preview.errors.length} row(s) have errors and will be skipped during import.
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-96 overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {preview.headers.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 20).map((row, idx) => {
                      const rowErrors = preview.errors.filter((e) => e.row === idx + 1);
                      return (
                        <TableRow
                          key={idx}
                          className={rowErrors.length > 0 ? "bg-destructive/5" : undefined}
                        >
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          {preview.headers.map((h) => (
                            <TableCell key={h} className="text-sm">
                              {row[h] || "—"}
                            </TableCell>
                          ))}
                          <TableCell>
                            {rowErrors.length > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {rowErrors[0].message}
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-xs">
                                Valid
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {preview.totalRows > 20 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first 20 of {preview.totalRows} rows
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setPreview(null);
                setFileKey(null);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={handleStartImport} loading={startMutation.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              Import {preview.totalRows - preview.errors.length} valid rows
            </Button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 font-semibold">Importing Users...</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {importJob
                ? `${importJob.processedRows} / ${importJob.totalRows} rows processed`
                : "Starting import..."}
            </p>
            {importJob && (
              <div className="mx-auto mt-4 h-2 w-full max-w-xs rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: `${importJob.totalRows > 0 ? (importJob.processedRows / importJob.totalRows) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === "complete" && importJob && (
        <Card>
          <CardContent className="py-12 text-center">
            {importJob.status === "completed" ? (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-success" />
                <h3 className="mt-4 font-semibold">Import Complete</h3>
                <div className="mt-4 flex justify-center gap-6 text-sm">
                  <div>
                    <p className="text-2xl font-bold text-success">{importJob.successCount}</p>
                    <p className="text-muted-foreground">Imported</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{importJob.errorCount}</p>
                    <p className="text-muted-foreground">Errors</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{importJob.totalRows}</p>
                    <p className="text-muted-foreground">Total Rows</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="mt-4 font-semibold">Import Failed</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The import could not be completed. Please check your file and try again.
                </p>
              </>
            )}

            {importJob.errors.length > 0 && (
              <div className="mx-auto mt-6 max-w-md text-left">
                <h4 className="mb-2 text-sm font-semibold">Errors:</h4>
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {importJob.errors.slice(0, 10).map((err, i) => (
                    <div key={i} className="border-b px-3 py-2 text-xs last:border-0">
                      <span className="text-muted-foreground">Row {err.row}:</span> {err.field} —{" "}
                      {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setPreview(null);
                  setFileKey(null);
                  setJobId(null);
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Another
              </Button>
              <Button asChild>
                <Link to="/users/students">View Students</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
