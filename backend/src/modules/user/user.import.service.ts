import { randomBytes } from 'node:crypto';

import { EmailSchema } from '@utl/shared';
import { parse } from 'csv-parse/sync';

import { AppError } from '@/common/errors/index.js';
import { createPresignedUpload, fetchObject } from '@/common/s3.js';
import { env } from '@/config/env.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueImport } from '@/jobs/import.queue.js';
import { hashPassword } from '@/modules/auth/password.util.js';

interface RowError {
  row: number;
  field: string;
  message: string;
}

const REQUIRED_HEADERS = ['name', 'email'] as const;

/**
 * Read a CSV out of S3 and return the parsed rows (as string maps) along with
 * per-row validation errors. Used both for the interactive preview endpoint
 * and by the worker before insertion.
 */
export async function readAndValidateCsv(fileKey: string): Promise<{
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  errors: RowError[];
}> {
  const buffer = await fetchObject(env.S3_BUCKET_UPLOADS, fileKey);
  const rows = parse(buffer, {
    columns: (h: string[]) => h.map((c) => c.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const headers = rows.length ? Object.keys(rows[0] ?? {}) : [];
  const errors: RowError[] = [];

  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      errors.push({ row: 0, field: h, message: `Missing required column "${h}"` });
    }
  }

  rows.forEach((r, i) => {
    if (!r.name?.trim()) errors.push({ row: i + 2, field: 'name', message: 'Name is required' });
    const emailParse = EmailSchema.safeParse(r.email);
    if (!emailParse.success) {
      errors.push({ row: i + 2, field: 'email', message: 'Invalid email' });
    }
  });

  return { headers, rows, totalRows: rows.length, errors };
}

export async function createUploadUrl(tenantId: string, fileName: string, contentType: string) {
  const upload = await createPresignedUpload({
    kind: 'import',
    tenantId,
    fileName,
    contentType,
    subfolder: 'users',
  });
  return { uploadUrl: upload.uploadUrl, fileKey: upload.fileKey };
}

export async function startImport(opts: {
  tenantId: string;
  actorId: string;
  fileKey: string;
  role: 'STUDENT' | 'TEACHER';
  classId?: string;
}) {
  const job = await getPrisma().importJob.create({
    data: {
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      kind: opts.role,
      fileKey: opts.fileKey,
      status: 'PENDING',
      meta: opts.classId ? { classId: opts.classId } : {},
    },
  });
  await enqueueImport({ jobId: job.id });
  return { jobId: job.id };
}

export async function getJob(jobId: string) {
  const j = await getPrisma().importJob.findFirst({ where: { id: jobId } });
  if (!j) throw AppError.notFound('Import job not found');
  return {
    id: j.id,
    status: j.status,
    totalRows: j.totalRows,
    processedRows: j.processedRows,
    successCount: j.successCount,
    errorCount: j.errorCount,
    errors: j.errors,
    createdAt: j.createdAt.toISOString(),
    completedAt: j.completedAt?.toISOString() ?? null,
  };
}

/**
 * Worker entrypoint. Reads the file, validates, and inserts users in bulk.
 * Progress is written back to the ImportJob row for the frontend poller.
 */
export async function runImportJob(jobId: string): Promise<void> {
  const prisma = getPrisma();
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Import job ${jobId} not found`);

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: 'PROCESSING' },
  });

  try {
    const { rows, totalRows, errors } = await readAndValidateCsv(job.fileKey);
    let successCount = 0;
    let processed = 0;

    for (const row of rows) {
      processed++;
      try {
        const email = row.email?.toLowerCase();
        if (!email || !row.name?.trim()) continue;
        const existing = await prisma.user.findFirst({ where: { email } });
        if (existing) {
          errors.push({ row: processed + 1, field: 'email', message: 'Already exists' });
          continue;
        }
        const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
        await prisma.user.create({
          data: {
            tenantId: job.tenantId,
            email,
            name: row.name.trim(),
            phone: row.phone?.trim() || undefined,
            role: job.kind === 'TEACHER' ? 'TEACHER' : 'STUDENT',
            status: 'INVITED',
            passwordHash,
            classId: row.classid?.trim() || undefined,
          },
        });
        successCount++;
      } catch (err) {
        errors.push({
          row: processed + 1,
          field: 'row',
          message: err instanceof Error ? err.message : 'Insert failed',
        });
      }
      // Persist progress every 25 rows so the UI feels responsive.
      if (processed % 25 === 0) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: { processedRows: processed, successCount, errorCount: errors.length },
        });
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        totalRows,
        processedRows: processed,
        successCount,
        errorCount: errors.length,
        errors: errors as never,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errors: [
          { row: 0, field: 'file', message: err instanceof Error ? err.message : String(err) },
        ] as never,
      },
    });
    throw err;
  }
}
