import { test, expect, type Page } from "@playwright/test";
async function submit(page: Page, subject: string) {
  await page.goto("/customer");
  await page.getByLabel("Request subject").fill(subject);
  await page
    .getByLabel("What can we help with?")
    .fill(
      "The router has not connected since this morning. Please fix my internet connection.",
    );
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page).toHaveURL(/\/customer\/tickets\//);
  return page.url().split("/").at(-1)!;
}
test("client submits, consultant routes, client refreshes, then spam and restore", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "manual",
    "Manual flow is verified in manual mode",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const id = await submit(page, `Connection outage ${Date.now()}`);
  await expect(page.getByText("Your request is saved")).toBeVisible();
  const consultant = await context.newPage();
  await consultant.goto(`/consultant/tickets/${id}`);
  await consultant.getByLabel("Category and team").selectOption("technical");
  await consultant.getByRole("button", { name: "Assign to team" }).click();
  await expect(
    consultant.getByRole("button", { name: "Change assignment" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(
    page.getByRole("heading", { name: "IT", exact: true }),
  ).toBeVisible();
  await consultant.getByRole("button", { name: "Move to spam" }).click();
  await expect(
    consultant.getByRole("button", { name: "Restore to queue" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(
    page.getByText("A consultant marked this request as spam."),
  ).toBeVisible();
  await consultant.getByRole("button", { name: "Restore to queue" }).click();
  await expect(
    consultant.getByRole("button", { name: "Assign to team" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Your request is saved")).toBeVisible();
  expect(errors).toEqual([]);
});
test("identical Jev answer routes below threshold and waits above threshold", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "jev",
    "Uses the SDK with controlled HTTP transport",
  );
  await page.goto("/consultant/settings");
  await page.getByLabel("Minimum confidence", { exact: true }).fill("0.90");
  await page.getByRole("button", { name: "Save thresholds" }).click();
  await expect(page.getByText("SETTINGS / VERSION 2")).toBeVisible();
  const first = await submit(page, `Automatic request ${Date.now()}`);
  await expect(
    page.getByRole("heading", { name: "IT", exact: true }),
  ).toBeVisible();
  await page.goto("/consultant/settings");
  await page.getByLabel("Minimum confidence", { exact: true }).fill("0.99");
  await page.getByRole("button", { name: "Save thresholds" }).click();
  await expect(page.getByText("SETTINGS / VERSION 3")).toBeVisible();
  const second = await submit(page, `Manual request ${Date.now()}`);
  await expect(page.getByText("Your request is saved")).toBeVisible();
  await page.goto(`/consultant/tickets/${second}`);
  await expect(
    page.getByText("Confidence below the threshold: 0.95 < 0.99"),
  ).toBeVisible();
  await page.goto(`/consultant/tickets/${first}`);
  await page.getByText("What would happen with current thresholds?").click();
  await expect(
    page.getByText("Consultant review: Confidence below the threshold"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change assignment" }),
  ).toBeVisible();
});
test("API 429 leaves a saved ticket in manual review", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "jev");
  const id = await submit(page, "[429] Model unavailable");
  await expect(page.getByText("Your request is saved")).toBeVisible();
  await page.goto(`/consultant/tickets/${id}`);
  await expect(
    page.getByRole("paragraph").filter({
      hasText: "Analysis unavailable. Consultant review required",
    }),
  ).toBeVisible();
});
test("stale settings form cannot overwrite newer thresholds", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "manual");
  await page.goto("/consultant/settings");
  const other = await context.newPage();
  await other.goto("/consultant/settings");
  await page.getByLabel("Minimum confidence", { exact: true }).fill("0.81");
  await page.getByRole("button", { name: "Save thresholds" }).click();
  await expect(page.getByText("SETTINGS / VERSION 2")).toBeVisible();
  await other.getByLabel("Minimum confidence", { exact: true }).fill("0.5");
  await other.getByRole("button", { name: "Save thresholds" }).click();
  await expect(other.getByRole("status")).toContainText("The data has changed");
  await other.reload();
  await expect(
    other.getByLabel("Minimum confidence", { exact: true }),
  ).toHaveValue("0.81");
});
test("mobile portal supports navigation without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: /Go to the customer portal/ }).click();
  await expect(page).toHaveURL(/\/customer$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("category override and reset persist across reload", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "manual");
  await page.goto("/consultant/settings");
  await page
    .getByLabel("Threshold: Technical issue", { exact: true })
    .fill("0.75");
  await page.getByRole("button", { name: "Save thresholds" }).click();
  await expect(page.getByText("SETTINGS / VERSION 3")).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Threshold: Technical issue", { exact: true }),
  ).toHaveValue("0.75");
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await expect(page.getByText("SETTINGS / VERSION 4")).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Minimum confidence", { exact: true }),
  ).toHaveValue("0.9");
  await expect(
    page.getByLabel("Threshold: Technical issue", { exact: true }),
  ).toHaveValue("");
});
