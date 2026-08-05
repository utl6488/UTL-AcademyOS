import { describe, expect, it } from 'vitest';

import { Permission, permissionsFor } from './constants.js';

describe('RBAC permission map', () => {
  it('SUPER_ADMIN has every permission', () => {
    const set = permissionsFor('SUPER_ADMIN');
    for (const p of Object.values(Permission)) {
      expect(set.has(p)).toBe(true);
    }
  });

  it('STUDENT cannot manage exams', () => {
    const set = permissionsFor('STUDENT');
    expect(set.has(Permission.EXAM_MANAGE)).toBe(false);
    expect(set.has(Permission.EXAM_TAKE)).toBe(true);
  });

  it('INSTITUTE_OWNER can manage billing and users', () => {
    const set = permissionsFor('INSTITUTE_OWNER');
    expect(set.has(Permission.BILLING_MANAGE)).toBe(true);
    expect(set.has(Permission.USER_MANAGE)).toBe(true);
  });

  it('TEACHER cannot manage billing', () => {
    const set = permissionsFor('TEACHER');
    expect(set.has(Permission.BILLING_MANAGE)).toBe(false);
    expect(set.has(Permission.QUESTION_MANAGE)).toBe(true);
  });
});
