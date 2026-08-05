import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test("login page has no axe violations", async ({ page }) => {
    await page.goto("/auth/login");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("signup page has no axe violations", async ({ page }) => {
    await page.goto("/auth/signup");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("404 page has no axe violations", async ({ page }) => {
    await page.goto("/not-found-page");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("403 page has no axe violations", async ({ page }) => {
    await page.goto("/403");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
