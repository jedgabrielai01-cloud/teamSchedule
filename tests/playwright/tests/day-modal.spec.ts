import { test, expect } from "@playwright/test";

async function loginAndGoToCalendar(page: import("@playwright/test").Page, user = "Alice") {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(user);
  await page.getByPlaceholder("Password").fill("RSD");
  await page.getByRole("button", { name: /login/i }).click();
  await page.waitForURL(user === "Admin" ? /admin/ : /calendar/);
}

async function openFirstDayModal(page: import("@playwright/test").Page) {
  const box = page.locator('[data-testid="day-box"]').first();
  await box.hover();
  await box.locator('[data-testid="day-edit-btn"]').click();
  await expect(page.locator('[data-testid="day-modal"]')).toBeVisible();
}

test("hovering a day in current month shows edit button", async ({ page }) => {
  await loginAndGoToCalendar(page);
  const box = page.locator('[data-testid="day-box"]').first();
  await box.hover();
  await expect(box.locator('[data-testid="day-edit-btn"]')).toBeVisible();
});

test("clicking edit button opens day modal", async ({ page }) => {
  await loginAndGoToCalendar(page);
  await openFirstDayModal(page);
});

test("modal shows Primary Support and Vacation Leaves sections", async ({ page }) => {
  await loginAndGoToCalendar(page);
  await openFirstDayModal(page);
  await expect(page.locator("text=/primary support/i").first()).toBeVisible();
  await expect(page.locator("text=/vacation leaves/i").first()).toBeVisible();
});

test("close button dismisses modal", async ({ page }) => {
  await loginAndGoToCalendar(page);
  await openFirstDayModal(page);
  await page.locator('[data-testid="modal-close"]').click();
  await expect(page.locator('[data-testid="day-modal"]')).not.toBeVisible();
});

test("clicking backdrop dismisses modal", async ({ page }) => {
  await loginAndGoToCalendar(page);
  await openFirstDayModal(page);
  await page.mouse.click(5, 5);
  await expect(page.locator('[data-testid="day-modal"]')).not.toBeVisible();
});

test("admin day modal shows member picker in Add Leave form", async ({ page }) => {
  await loginAndGoToCalendar(page, "Admin");
  await page.locator("button:has-text('Calendar')").click();
  const box = page.locator('[data-testid="day-box"]').first();
  await box.hover();
  await box.locator('[data-testid="day-edit-btn"]').click();
  await expect(page.locator('[data-testid="day-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="day-modal"] select').first()).toBeVisible();
});
