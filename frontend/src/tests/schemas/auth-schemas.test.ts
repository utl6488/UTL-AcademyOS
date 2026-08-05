import { describe, expect, it } from "vitest";

import {
  authResponseSchema,
  loginSchema,
  signupSchema,
} from "@/features/auth/schemas/auth-schemas";

describe("loginSchema", () => {
  it("validates correct credentials", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const validData = {
    instituteName: "Test School",
    ownerName: "Jane Doe",
    email: "jane@test.com",
    password: "correcthorsebattery",
    confirmPassword: "correcthorsebattery",
    acceptTerms: true,
  } as const;

  it("validates correct signup data", () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({ ...validData, confirmPassword: "different1234" });
    expect(result.success).toBe(false);
  });

  it("rejects short passwords", () => {
    const result = signupSchema.safeParse({
      ...validData,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short institute name", () => {
    const result = signupSchema.safeParse({ ...validData, instituteName: "AB" });
    expect(result.success).toBe(false);
  });

  it("rejects without terms acceptance", () => {
    const result = signupSchema.safeParse({ ...validData, acceptTerms: false });
    expect(result.success).toBe(false);
  });
});

describe("authResponseSchema", () => {
  it("accepts a well-formed login response", () => {
    const result = authResponseSchema.safeParse({
      user: {
        id: "u_1",
        email: "jane@test.com",
        name: "Jane Doe",
        role: "INSTITUTE_OWNER",
        status: "ACTIVE",
        emailVerified: true,
        tenantId: "t_1",
        permissions: ["exam:read", "exam:manage"],
      },
      tokens: { access: "a", refresh: "r" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown role", () => {
    const result = authResponseSchema.safeParse({
      user: {
        id: "u_1",
        email: "jane@test.com",
        name: "Jane Doe",
        role: "WIZARD",
        status: "ACTIVE",
        emailVerified: true,
        tenantId: "t_1",
        permissions: [],
      },
      tokens: { access: "a", refresh: "r" },
    });
    expect(result.success).toBe(false);
  });
});
