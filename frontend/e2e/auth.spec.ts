import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("login form validates required fields", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Please enter a valid email")).toBeVisible();
  });

  test("signup page has all required fields", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByLabel("Institute Name")).toBeVisible();
    await expect(page.getByLabel("URL Slug")).toBeVisible();
    await expect(page.getByLabel("First Name")).toBeVisible();
    await expect(page.getByLabel("Last Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("forgot password flow", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.getByRole("heading", { name: "Forgot password" })).toBeVisible();
    await expect(page.getByText("Back to sign in")).toBeVisible();
  });

  test("navigates between login and signup", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByText("Sign up").click();
    await expect(page).toHaveURL(/\/auth\/signup/);
    await page.getByText("Sign in").click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
