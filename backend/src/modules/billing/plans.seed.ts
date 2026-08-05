import type { PlanInterval, PlanTier } from '@prisma/client';

// Central plan definitions. `db.seed` inserts these; the billing service also
// idempotently upserts on boot so a fresh dev DB doesn't strand the frontend.
export interface PlanSeed {
  tier: PlanTier;
  name: string;
  priceCents: number;
  currency: string;
  interval: PlanInterval;
  features: string[];
  limits: {
    students: number;
    exams: number;
    aiCredits: number;
    storageMb: number;
  };
  isPublic: boolean;
}

// Numbers are placeholders and will be revisited with the pricing page copy.
export const PLAN_SEEDS: PlanSeed[] = [
  {
    tier: 'FREE',
    name: 'Free',
    priceCents: 0,
    currency: 'INR',
    interval: 'MONTHLY',
    features: ['Up to 50 students', '5 exams per month', 'Basic proctoring', 'Community support'],
    limits: { students: 50, exams: 5, aiCredits: 100, storageMb: 500 },
    isPublic: true,
  },
  {
    tier: 'BASIC',
    name: 'Basic',
    priceCents: 199900,
    currency: 'INR',
    interval: 'MONTHLY',
    features: [
      'Up to 500 students',
      '50 exams per month',
      'AI question generation',
      'Email support',
    ],
    limits: { students: 500, exams: 50, aiCredits: 2000, storageMb: 5000 },
    isPublic: true,
  },
  {
    tier: 'PRO',
    name: 'Pro',
    priceCents: 499900,
    currency: 'INR',
    interval: 'MONTHLY',
    features: [
      'Up to 5,000 students',
      'Unlimited exams',
      'AI + advanced proctoring (auto-submit, multi-display)',
      'Priority support',
    ],
    limits: { students: 5000, exams: 999999, aiCredits: 20000, storageMb: 50000 },
    isPublic: true,
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    priceCents: 0, // custom-quoted
    currency: 'INR',
    interval: 'MONTHLY',
    features: [
      'Unlimited students + exams',
      'Webcam proctoring',
      'UTL Secure Browser',
      'Dedicated support + SLA',
    ],
    limits: { students: 999999, exams: 999999, aiCredits: 999999, storageMb: 500000 },
    isPublic: false, // contact-sales only
  },
];
