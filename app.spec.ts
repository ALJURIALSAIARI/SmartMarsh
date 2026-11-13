import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

test("project ZIP downloads as a Blob even when site ZIP URLs are unavailable", async ({
  page,
}) => {
  const zipRequests: string[] = [];
  await page.route(/\.zip(?:[?#]|$)/, (route) => {
    zipRequests.push(route.request().url());
    return route.fulfill({ status: 404, body: "File wasn't available on site" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Simulation workspace" })).toBeVisible();
  const button = page.getByRole("button", { name: "تحميل المشروع ZIP", exact: true });
  test.skip(
    (await button.count()) === 0,
    "The standalone export intentionally omits its own source archive.",
  );
  await expect(button).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await button.click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("SmartMarsh-GitHub.zip");
  expect(file.url()).toMatch(/^blob:/);
  expect(await file.failure()).toBeNull();
  expect(await readFile((await file.path())!)).toEqual(
    await readFile("exports/SmartMarsh-GitHub.zip"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(button).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const mobileDownloaded = page.waitForEvent("download");
  await button.click();
  const mobileFile = await mobileDownloaded;
  expect(mobileFile.url()).toMatch(/^blob:/);
  expect(await mobileFile.failure()).toBeNull();
  expect(await readFile((await mobileFile.path())!)).toEqual(
    await readFile("exports/SmartMarsh-GitHub.zip"),
  );
  expect(zipRequests).toEqual([]);
});

test("uploaded SmartMarsh logo appears beside its name on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  const brandLogo = page.getByRole("img", { name: "SmartMarsh logo", exact: true });
  await expect(brandLogo).toBeVisible();
  expect(await brandLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(800);
  const modeLogo = page.getByRole("button", { name: "SmartMarsh", exact: true }).locator("img");
  await expect(modeLogo).toBeVisible();
  expect(await modeLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(800);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modeLogo).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(brandLogo).toBeVisible();
});

test("playback, driver notifications, pause, resume, reset and mode controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Simulation workspace" })).toBeVisible();
  await expect(page.locator(".simulation-kpis .kpi")).toHaveCount(4);
  await page.screenshot({ path: "/tmp/smartmarsh-initial.png", fullPage: true });
  await page.getByRole("button", { name: "Start simulation", exact: true }).click();
  await expect(page.locator(".driver-message strong")).toHaveText("GO TO GATE 1");
  await page.getByRole("button", { name: "Acknowledge notification", exact: true }).click();
  await expect(page.getByRole("button", { name: "Notification acknowledged" })).toBeDisabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page.getByRole("slider", { name: "Simulation timeline" }).inputValue();
  await page.waitForTimeout(180);
  expect(await page.getByRole("slider", { name: "Simulation timeline" }).inputValue()).toBe(paused);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByRole("slider", { name: "Simulation timeline" }).inputValue()),
    )
    .toBeGreaterThan(Number(paused));
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Playback speed").selectOption("20");
  await page.getByRole("button", { name: "Traditional", exact: true }).click();
  await expect(page.locator(".scene-mode")).toContainText("Engine-on gate queue");
  await page.getByRole("button", { name: "SmartMarsh", exact: true }).click();
  await page.getByRole("slider", { name: "Simulation timeline" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expand terminal" }).click();
  await expect(page.locator(".simulation-layout")).toHaveClass(/expanded-scene/);
  await page.getByRole("button", { name: "Collapse terminal" }).click();
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(page.getByRole("slider", { name: "Simulation timeline" })).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("paired metrics, actual CSV/XLSX exports, truck filters and generated conclusions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Run paired comparison", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analytics dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".analytics-kpis .kpi")).toHaveCount(10);
  await expect(page.locator(".recharts-wrapper")).toHaveCount(6);
  await expect(page.locator(".comparison-table tbody tr").first()).toContainText("30");
  await page.screenshot({ path: "/tmp/smartmarsh-analytics.png", fullPage: true });
  await page.getByRole("button", { name: "Truck Data Table", exact: true }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".pagination")).toContainText("11–20 of 30 trucks");
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "TRUCK", exact: true }).click();
  await expect(page.locator(".truck-table tbody tr").first()).toContainText("T30");
  await page.getByLabel("Search trucks").fill("T30");
  await expect(page.locator(".truck-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "View truck T30 events" }).click();
  await expect(page.getByRole("dialog")).toContainText("COMPLETED");
  await page.getByRole("button", { name: "Close truck details" }).click();
  const csvWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const csvDownload = await csvWait;
  const csv = await readFile((await csvDownload.path())!, "utf8");
  expect(csv).toContain("stationary_engine_on_idle_min");
  expect(csv).toContain('"T30"');
  expect(csv.trim().split("\n")).toHaveLength(2);
  const xlsxWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export XLSX", exact: true }).click();
  const xlsxDownload = await xlsxWait;
  const workbook = XLSX.read(await readFile((await xlsxDownload.path())!));
  expect(workbook.SheetNames).toEqual(["Truck data", "Event log", "Assumptions"]);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Truck data"]);
  expect(rows).toHaveLength(1);
  expect(rows[0].truck).toBe("T30");
  expect(rows[0].stationary_engine_on_idle_min).toBeCloseTo(0.4);
  expect(Number(rows[0].service_end_min)).toBeGreaterThan(Number(rows[0].arrival_min));
  await page.getByLabel("Search trucks").fill("no-such-truck");
  await expect(page.getByText("No trucks found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Filter trucks by state").selectOption("COMPLETED");
  await expect(page.locator(".pagination")).toContainText("30 trucks");
  await page.getByRole("button", { name: "Results & Conclusions", exact: true }).click();
  await expect(page.locator(".results-hero")).toContainText("less engine-on idling");
  await expect(page.locator(".conclusion-card.tradeoff")).toContainText("SmartMarsh is slower");
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "Print / save report" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.screenshot({ path: "/tmp/smartmarsh-results.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("all settings affect a reset experiment, persist, validate and restore", async ({ page }) => {
  await page.goto("/#settings");
  const values: Record<string, string> = {
    "Number of trucks": "5",
    "Service gates": "2",
    "Mean service duration": "3",
    "Mean arrival interval": ".2",
    "Travel time to gate": ".4",
    "Check-in duration": ".2",
    "Random seed": "123",
    "Playback speed": "5",
    "Diesel idle consumption": "3",
    "Diesel CO₂ factor": "2.5",
  };
  await page.getByLabel("Number of trucks", { exact: true }).fill("101");
  await page.getByRole("button", { name: "Save & apply settings" }).click();
  await expect(page.getByText("Enter a whole number from 5 to 100.")).toBeVisible();
  for (const [label, value] of Object.entries(values))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Save & apply settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved and applied");
  await page.reload();
  for (const [label, value] of Object.entries(values))
    expect(Number(await page.getByLabel(label, { exact: true }).inputValue())).toBe(Number(value));
  await page.getByRole("button", { name: "Simulation", exact: true }).click();
  await expect(page.locator(".gate-row")).toHaveCount(2);
  await expect(page.locator(".toolbar-context")).toContainText("5 trucks");
  await page.getByRole("button", { name: "Run paired comparison", exact: true }).click();
  await expect(page.locator(".analytics-kpis .kpi").first()).toContainText("5");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Restore defaults", exact: true }).click();
  await page.getByRole("button", { name: "Save & apply settings" }).click();
  await expect(page.getByLabel("Number of trucks", { exact: true })).toHaveValue("30");
  await page.getByRole("button", { name: "Simulation", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Simulation timeline" })).toHaveValue("0");
});

test("mobile navigation and all six pages have no viewport overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: "/tmp/smartmarsh-mobile.png", fullPage: true });
  for (const [label, heading] of [
    ["About the Project", "About the project"],
    ["Settings", "Simulation settings"],
    ["Results & Conclusions", "Results & conclusions"],
    ["Truck Data Table", "Truck data register"],
    ["Analytics Dashboard", "Analytics dashboard"],
    ["Simulation", "Simulation workspace"],
  ]) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("driver acknowledgments survive navigation and the complete event history is filterable and exportable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Playback speed").selectOption("0.5");
  await page.getByRole("button", { name: "Start simulation", exact: true }).click();
  await expect(page.locator(".driver-message strong")).toHaveText("GO TO GATE 1");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const snapshot = Number(
    await page.getByRole("slider", { name: "Simulation timeline" }).inputValue(),
  );
  await page.getByRole("button", { name: "Acknowledge notification", exact: true }).click();
  await expect(page.locator(".driver-ack-time")).toContainText("Acknowledged at");
  await page.getByRole("button", { name: "Analytics Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Simulation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Notification acknowledged" })).toBeDisabled();
  await page.getByLabel("Filter event category").selectOption("acknowledged");
  await expect(page.locator(".event-row")).toHaveCount(1);
  await expect(page.locator(".event-row")).toHaveAttribute("data-event-state", "ACKNOWLEDGED");
  const acknowledgmentDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export event log CSV" }).click();
  const acknowledgmentCsv = await readFile((await (await acknowledgmentDownload).path())!, "utf8");
  const acknowledgmentWorkbook = XLSX.read(acknowledgmentCsv.replace(/^\uFEFF/, ""), {
    type: "string",
  });
  const acknowledgmentRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    acknowledgmentWorkbook.Sheets[acknowledgmentWorkbook.SheetNames[0]],
  );
  expect(acknowledgmentRows).toHaveLength(1);
  expect(acknowledgmentRows[0].source).toBe("DRIVER PREVIEW");
  expect(acknowledgmentRows[0].time_min).toBeCloseTo(snapshot, 10);
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(page.locator(".driver-ack-time")).toHaveCount(0);
  await expect(page.locator(".event-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Run paired comparison", exact: true }).click();
  await page.getByRole("button", { name: "Simulation", exact: true }).click();
  await expect(page.locator(".event-pagination")).toContainText("1–20 of 240 records");
  for (let i = 0; i < 11; i++) await page.getByRole("button", { name: "Next event page" }).click();
  await expect(page.locator(".event-pagination")).toContainText("221–240 of 240 records");
  await expect(page.locator(".event-row").last()).toContainText("Arrived at terminal");
  await page.getByLabel("Filter event category").selectOption("arrivals");
  await expect(page.locator(".event-pagination")).toContainText("1–20 of 30 records");
  const arrivalsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export event log CSV" }).click();
  const arrivalsCsv = await readFile((await (await arrivalsDownload).path())!, "utf8");
  expect(arrivalsCsv.trim().split("\n")).toHaveLength(31);
  expect(arrivalsCsv).toContain('"T1"');
  expect(arrivalsCsv).toContain('"T30"');
  await page.getByLabel("Filter event log", { exact: true }).selectOption("selected");
  await expect(page.locator(".event-row")).toHaveCount(1);
  await expect(page.locator(".event-row")).toContainText("T1");
});

test("partial snapshots do not invent averages or reveal future assignments and empty exports retain their schema", async ({
  page,
}) => {
  await page.goto("/#analytics");
  await expect(page.locator(".analytics-kpis .kpi").nth(1).locator(".kpi-value")).toContainText(
    "—",
  );
  await expect(page.locator(".analytics-kpis .kpi").nth(5).locator(".kpi-value")).toContainText(
    "—",
  );
  await expect(page.locator(".analytics-kpis .kpi").nth(6).locator(".kpi-value")).toContainText(
    "—",
  );
  await expect(page.locator(".analytics-kpis .kpi").nth(7).locator(".kpi-value")).toContainText(
    "—",
  );
  const turnaroundRow = page
    .locator(".comparison-table tbody tr")
    .filter({ hasText: "Mean truck turnaround" });
  await expect(turnaroundRow).toContainText("Awaiting completion");
  await page.getByRole("button", { name: "Truck Data Table", exact: true }).click();
  await page.getByRole("button", { name: "COMPLETED", exact: true }).click();
  await page.getByRole("button", { name: "COMPLETED", exact: true }).click();
  expect(await page.locator(".truck-id").allTextContents()).toEqual(
    Array.from({ length: 10 }, (_, i) => `T${i + 1}`),
  );
  const snapshotDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const snapshotCsv = await readFile((await (await snapshotDownload).path())!, "utf8");
  const snapshotWorkbook = XLSX.read(snapshotCsv.replace(/^\uFEFF/, ""), { type: "string" });
  const snapshotRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    snapshotWorkbook.Sheets[snapshotWorkbook.SheetNames[0]],
    { defval: "" },
  );
  expect(snapshotRows).toHaveLength(30);
  for (const row of snapshotRows) {
    expect(row.gate).toBe("");
    expect(row.checked_in_min).toBe("");
    expect(row.called_forward_min).toBe("");
    expect(row.service_end_min).toBe("");
    expect(row.turnaround_min).toBe("");
  }
  await page.getByLabel("Search trucks").fill("no-matching-truck");
  const emptyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export XLSX", exact: true }).click();
  const emptyWorkbook = XLSX.read(await readFile((await (await emptyDownload).path())!));
  const emptyData = XLSX.utils.sheet_to_json<string[]>(emptyWorkbook.Sheets["Truck data"], {
    header: 1,
  });
  expect(emptyData).toHaveLength(1);
  expect(emptyData[0]).toContain("service_end_min");
  expect(emptyData[0]).toContain("idle_CO2_kg");
  const emptyEvents = XLSX.utils.sheet_to_json<string[]>(emptyWorkbook.Sheets["Event log"], {
    header: 1,
  });
  expect(emptyEvents).toHaveLength(1);
  expect(emptyEvents[0]).toContain("state");
});
