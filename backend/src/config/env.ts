import { z } from 'zod';

const trueish = ['1', 'true', 'yes', 'on'];

const csv = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Empty strings from .env files should behave like "not set" so `.optional()` works.
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => csv(v)),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_BUCKET_UPLOADS: z.string().default('utl-uploads'),
  S3_BUCKET_QUESTION_IMAGES: z.string().default('utl-question-images'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((v) => trueish.includes(v.toLowerCase())),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: z.string().default('UTL-AcademyOS <no-reply@utl-academyos.local>'),

  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  SENTRY_DSN: optionalUrl,

  APP_URL: z.string().url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Reset cache — test-only. */
export function _resetEnvForTests(): void {
  cachedEnv = null;
}

export const env = loadEnvSafe();

function loadEnvSafe(): Env {
  try {
    return loadEnv();
  } catch (err) {
    if (process.env.NODE_ENV === 'test') {
      return {
        NODE_ENV: 'test',
        PORT: 0,
        LOG_LEVEL: 'silent',
        CORS_ORIGINS: [],
        DATABASE_URL: 'postgresql://test@localhost/test',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'x'.repeat(32),
        JWT_REFRESH_SECRET: 'y'.repeat(32),
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
        S3_REGION: 'us-east-1',
        S3_BUCKET_UPLOADS: 'utl-uploads',
        S3_BUCKET_QUESTION_IMAGES: 'utl-question-images',
        S3_FORCE_PATH_STYLE: true,
        SMTP_HOST: 'localhost',
        SMTP_PORT: 1025,
        SMTP_FROM: 'test',
        APP_URL: 'http://localhost:5173',
      } as Env;
    }
    throw err;
  }
}
