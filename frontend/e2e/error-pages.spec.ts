import { test, expect } from "@playwright/test";

test.describe("Error Pages", () => {
  test("shows 404 for unknown routes", async ({ page }) => {
    await page.goto("/some-nonexistent-page");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("shows 403 page", async ({ page }) => {
    await page.goto("/403");
    await expect(page.getByText("403")).toBeVisible();
    await expect(page.getByText("Access denied")).toBeVisible();
  });

  test("404 page has go home button", async ({ page }) => {
    await page.goto("/unknown-route");
    await expect(page.getByRole("link", { name: "Go back home" })).toBeVisible();
  });
});
