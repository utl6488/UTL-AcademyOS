import { describe, expect, it } from 'vitest';

import { QuestionType, Role, SubscriptionPlan } from './enums.js';
import { SignupSchema } from './schemas.js';

describe('shared enums', () => {
  it('Role catalogue matches the RBAC spec', () => {
    expect(Object.keys(Role).sort()).toEqual(
      ['ADMIN', 'EXAM_COORDINATOR', 'INSTITUTE_OWNER', 'STUDENT', 'SUPER_ADMIN', 'TEACHER'].sort(),
    );
  });

  it('exposes all 8 question types', () => {
    expect(Object.keys(QuestionType)).toHaveLength(8);
  });

  it('exposes four subscription plans', () => {
    expect(Object.keys(SubscriptionPlan)).toEqual(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']);
  });
});

describe('shared schemas', () => {
  it('SignupSchema rejects short passwords', () => {
    const result = SignupSchema.safeParse({
      instituteName: 'Acme Coaching',
      ownerName: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('SignupSchema accepts a well-formed payload', () => {
    const result = SignupSchema.safeParse({
      instituteName: 'Acme Coaching',
      ownerName: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'correct-horse-battery',
    });
    expect(result.success).toBe(true);
  });
});
