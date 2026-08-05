import { randomUUID } from 'node:crypto';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppError } from '@/common/errors/index.js';
import { env } from '@/config/env.js';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
// Uploads: 5 min is enough for the browser round-trip; anything longer widens
// the window in which a leaked pre-signed URL is usable.
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
// Downloads: 5 min — Phase 11 target. Consumers should fetch immediately or
// re-request; long-lived URLs are a common vector for accidental sharing.
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const cfg: S3ClientConfig = {
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY
      ? { credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }
      : {}),
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
  };
  cached = new S3Client(cfg);
  return cached;
}

export type UploadKind = 'logo' | 'photo' | 'question' | 'import';

const BUCKET_FOR: Record<UploadKind, () => string> = {
  logo: () => env.S3_BUCKET_UPLOADS,
  photo: () => env.S3_BUCKET_UPLOADS,
  question: () => env.S3_BUCKET_QUESTION_IMAGES,
  import: () => env.S3_BUCKET_UPLOADS,
};

interface PresignedUpload {
  uploadUrl: string;
  bucket: string;
  key: string;
  fileUrl: string;
  fileKey: string;
  contentType: string;
}

interface CreateUploadOptions {
  kind: UploadKind;
  tenantId: string;
  fileName: string;
  contentType: string;
  subfolder?: string;
}

/**
 * Mint a PUT pre-signed URL. Also returns the public/download URL the caller
 * should persist alongside the resource.
 */
export async function createPresignedUpload(opts: CreateUploadOptions): Promise<PresignedUpload> {
  if (!ALLOWED_MIME.has(opts.contentType)) {
    throw AppError.badRequest(`Unsupported content type: ${opts.contentType}`);
  }
  const bucket = BUCKET_FOR[opts.kind]();
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-64);
  const key = [
    `t/${opts.tenantId}`,
    opts.kind,
    opts.subfolder ?? '',
    `${Date.now()}-${randomUUID()}-${safeName}`,
  ]
    .filter(Boolean)
    .join('/');

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: opts.contentType,
    ContentLength: undefined,
    // Server-side max via lifecycle policy is out of scope; enforce client-side
    // and trust the pre-signed URL's PUT to fail if size is grossly wrong.
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });

  return {
    uploadUrl,
    bucket,
    key,
    fileKey: key,
    fileUrl: publicUrlFor(bucket, key),
    contentType: opts.contentType,
  };
}

/** Time-limited GET url for private objects. */
export async function createSignedDownload(bucket: string, key: string): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}

/** Publicly reachable URL. In dev this is MinIO's forwarded endpoint. */
export function publicUrlFor(bucket: string, key: string): string {
  const base = (env.S3_ENDPOINT ?? `https://s3.${env.S3_REGION}.amazonaws.com`).replace(/\/$/, '');
  return env.S3_FORCE_PATH_STYLE ? `${base}/${bucket}/${key}` : `${base}/${key}`;
}

export async function fetchObject(bucket: string, key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw AppError.notFound('Object body missing');
  const chunks: Buffer[] = [];
  // Node stream — `transformToByteArray` is convenient if available.
  const bytes = await res.Body.transformToByteArray();
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw AppError.badRequest('File exceeds size limit');
  }
  chunks.push(Buffer.from(bytes));
  return Buffer.concat(chunks);
}

export const S3Limits = { MAX_UPLOAD_BYTES } as const;
