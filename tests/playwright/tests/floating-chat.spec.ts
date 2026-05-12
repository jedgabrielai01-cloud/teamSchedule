import { test, expect } from "@playwright/test";

async function loginAsAlice(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill("Alice");
  await page.getByPlaceholder("Password").fill("RSD");
  await page.getByRole("button", { name: /login/i }).click();
  await page.waitForURL(/calendar/);
}

test("floating chat bubble is visible after login", async ({ page }) => {
  await loginAsAlice(page);
  await expect(page.locator('[data-testid="chat-bubble"]')).toBeVisible();
});

test("no static AI sidebar panel on initial load", async ({ page }) => {
  await loginAsAlice(page);
  await expect(page.locator('[data-testid="chat-panel"]')).not.toBeVisible();
});

test("clicking bubble opens chat panel", async ({ page }) => {
  await loginAsAlice(page);
  await page.locator('[data-testid="chat-bubble"]').click();
  await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
});

test("clicking bubble again closes chat panel", async ({ page }) => {
  await loginAsAlice(page);
  await page.locator('[data-testid="chat-bubble"]').click();
  await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
  await page.locator('[data-testid="chat-bubble"]').click();
  await expect(page.locator('[data-testid="chat-panel"]')).not.toBeVisible();
});

test("Clear button resets the conversation", async ({ page }) => {
  await loginAsAlice(page);
  await page.locator('[data-testid="chat-bubble"]').click();
  await page.locator('[data-testid="chat-panel"] input[type="text"]').fill("hello");
  await page.locator('[data-testid="chat-panel"] button[type="submit"]').click();
  await expect(page.locator('[data-testid="chat-panel"]').getByText("hello")).toBeVisible();
  await page.locator('[data-testid="chat-panel"] button:has-text("Clear")').click();
  await expect(page.locator('[data-testid="chat-panel"]').getByText("hello")).not.toBeVisible();
});

test("floating chat works on admin page", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill("Admin");
  await page.getByPlaceholder("Password").fill("RSD");
  await page.getByRole("button", { name: /login/i }).click();
  await page.waitForURL(/admin/);
  await expect(page.locator('[data-testid="chat-bubble"]')).toBeVisible();
  await page.locator('[data-testid="chat-bubble"]').click();
  await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
});
