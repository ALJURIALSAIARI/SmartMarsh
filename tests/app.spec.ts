import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const title = "SmartMarsh Simulation";
async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function seek(page: Page, minute: number) {
  await page.getByRole("slider", { name: "Simulation timeline" }).fill(String(minute));
}
function csvRows(text: string) {
  const book = XLSX.read(text.replace(/^\uFEFF/, ""), { type: "string" });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], {
    defval: "",
  });
}

test("project ZIP downloads current source as a Blob on desktop and mobile", async ({ page }) => {
  const requests: string[] = [];
  await page.route(/\.zip(?:[?#]|$)/, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 404, body: "Unavailable" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const button = page.getByRole("button", { name: "تحميل المشروع ZIP", exact: true });
  test.skip(
    (await button.count()) === 0,
    "Standalone export intentionally omits its source archive.",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const waiting = page.waitForEvent("download");
    await button.click();
    const file = await waiting;
    expect(file.suggestedFilename()).toBe("SmartMarsh-GitHub.zip");
    expect(file.url()).toMatch(/^blob:/);
    expect(await file.failure()).toBeNull();
    expect(await readFile((await file.path())!)).toEqual(
      await readFile("exports/SmartMarsh-GitHub.zip"),
    );
  }
  expect(requests).toEqual([]);
});

test("original branding and navigation remain, without separate assignment links", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const logo = page.getByRole("img", { name: "SmartMarsh logo", exact: true });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(800);
  await expect(page.locator('a[href*="assignment"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Assignment [45]/ })).toHaveCount(0);
  await expect(page.locator(".sidebar nav button")).toHaveCount(6);
  await expect(page.locator(".gate-row")).toHaveCount(2);
  await expect(page.locator(".gate-row .badge")).toHaveText(["BUSY", "BUSY"]);
  await expect(page.locator(".toolbar-context")).toContainText("8 trucks");
  await expect(page.locator(".toolbar-context")).toContainText("2 gates");
  await expect(page.locator(".port-svg")).not.toContainText("G3");
  await page.setViewportSize({ width: 390, height: 844 });
  const modeLogo = page.getByRole("button", { name: "SmartMarsh", exact: true }).locator("img");
  await expect(modeLogo).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(logo).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`${width}px: original map, exact T1 states, playback, modes and reset use the appendix model`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.install();
    await page.goto("/");
    const slider = page.getByRole("slider", { name: "Simulation timeline" });
    await expect(slider).toHaveAttribute("max", "42");
    await expect(
      page.getByRole("button", { name: "Truck T1: ARRIVED", exact: true }),
    ).toBeVisible();
    const initialPosition = await page
      .getByRole("button", { name: "Truck T1: ARRIVED", exact: true })
      .getAttribute("transform");
    await seek(page, 0.5);
    expect(
      await page
        .getByRole("button", { name: "Truck T1: ARRIVED", exact: true })
        .getAttribute("transform"),
    ).not.toBe(initialPosition);
    for (const [minute, state, gate] of [
      [1, "WAIT ENGINE OFF", "BUSY"],
      [4, "CALLED FORWARD", "RESERVED"],
      [4.5, "PREPARING", "RESERVED"],
      [5, "MOVING", "RESERVED"],
      [7, "SERVICE", "BUSY"],
    ] as const) {
      await seek(page, minute);
      await expect(
        page.getByRole("button", { name: `Truck T1: ${state}`, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".gate-row").first().locator(".badge")).toHaveText(gate);
      const event = page.locator(`.event-row[data-event-state="${state}"]`).filter({
        has: page.getByRole("button", { name: "T1", exact: true }),
      });
      await expect(event.locator(".mono")).toHaveText(minute.toFixed(1));
      if (minute >= 4) await expect(page.locator(".port-svg")).toContainText(`${gate} · T1`);
    }
    await seek(page, 12);
    await expect(page.getByRole("button", { name: /^Truck T1:/ })).toHaveCount(0);
    await expect(page.locator(".driver-message strong")).toHaveText("Trip completed");
    await page.getByRole("button", { name: "Expand terminal" }).click();
    await expect(page.locator(".simulation-layout")).toHaveClass(/expanded-scene/);
    await page.getByRole("button", { name: "Collapse terminal" }).click();
    for (const mode of ["Traditional", "SmartMarsh"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await expect(slider).toHaveValue("0");
      await expect(page.locator(".gate-row .badge")).toHaveText(["BUSY", "BUSY"]);
      await page.getByLabel("Playback speed", { exact: true }).selectOption("20");
      await page.getByRole("button", { name: "Start simulation", exact: true }).click();
      await page.clock.runFor(80);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const paused = await slider.inputValue();
      await page.clock.runFor(200);
      await expect(slider).toHaveValue(paused);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page.clock.runFor(2200);
      await expect(slider).toHaveValue("42");
      await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeVisible();
      await expect(page.locator(".simulation-kpis .kpi").nth(1)).toContainText("8");
      await expect(
        page.locator(".simulation-kpis .kpi").nth(2).locator(".kpi-value"),
      ).toContainText(mode === "Traditional" ? "69.0" : "4.0");
      await expect(page.locator(".gate-row .badge")).toHaveText(["AVAILABLE", "AVAILABLE"]);
      await expect(page.locator(".scene-truck")).toHaveCount(0);
      await page.getByRole("button", { name: "Run again", exact: true }).click();
      await page.getByRole("button", { name: "Reset simulation", exact: true }).click();
      await expect(slider).toHaveValue("0");
      await expect(page.locator(".gate-row")).toHaveCount(2);
    }
    await page.screenshot({ path: `/tmp/smartmarsh-main-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

test("dashboard, all charts and results use exact appendix totals and shared utilization", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run paired comparison", exact: true }).click();
  await expect(page.locator(".analytics-kpis .kpi")).toHaveCount(10);
  await expect(page.locator(".recharts-wrapper")).toHaveCount(6);
  for (const [label, a, b] of [
    ["Completed trucks", "8", "8"],
    ["Stationary engine-on time", "69.000", "4.000"],
    ["Mean eligible queue time", "8.625", "10.875"],
    ["Mean pre-service time", "9.625", "14.875"],
    ["Mean truck turnaround", "14.875", "20.125"],
    ["Final truck completion", "32.000", "42.000"],
    ["Pre-service gate reservation", "8.000", "24.000"],
    ["Peak eligible queue", "4", "4"],
    ["Gate service utilization", "61.9", "61.9"],
    ["Shared observation window", "42.000", "42.000"],
  ]) {
    const row = page
      .locator(".comparison-table tbody tr")
      .filter({ has: page.locator("td").filter({ hasText: new RegExp(`^${label}$`) }) });
    await expect(row.locator("td").nth(1)).toContainText(a);
    await expect(row.locator("td").nth(2)).toContainText(b);
  }
  const gateChart = page.locator(".chart-grid .panel").last();
  await expect(gateChart).toContainText("G1");
  await expect(gateChart).toContainText("G2");
  await expect(gateChart).not.toContainText("G3");
  await page.screenshot({ path: "/tmp/smartmarsh-main-analytics.png", fullPage: true });
  await navigate(page, "Results & Conclusions");
  await expect(page.locator(".results-hero")).toContainText(
    "94.2% Reduction in stationary engine-on time",
  );
  await expect(page.locator(".conclusion-card.tradeoff")).toContainText(
    "+5.25 min mean turnaround",
  );
  await expect(page.locator(".conclusion-card").last()).toContainText("8 / 8 trucks completed");
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "Print / save report" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
});

test("both truck registers and actual CSV/XLSX exports include all eight corrected traces", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run paired comparison", exact: true }).click();
  await navigate(page, "Truck Data Table");
  for (const [mode, idleSum, finish, events] of [
    ["SmartMarsh", 4, 42, 80],
    ["Traditional", 69, 32, 64],
  ] as const) {
    await page.locator(".data-filters").getByRole("button", { name: mode, exact: true }).click();
    await expect(page.locator(".truck-table tbody tr")).toHaveCount(8);
    await expect(page.locator(".pagination")).toContainText("1–8 of 8 trucks");
    const waiting = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const rows = csvRows(await readFile((await (await waiting).path())!, "utf8"));
    expect(rows.map((r) => r.truck)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]);
    expect(rows.reduce((sum, r) => sum + Number(r.stationary_engine_on_idle_min), 0)).toBe(idleSum);
    expect(Math.max(...rows.map((r) => Number(r.service_end_min)))).toBe(finish);
    const xlsxWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export XLSX", exact: true }).click();
    const book = XLSX.read(await readFile((await (await xlsxWait).path())!));
    expect(book.SheetNames).toEqual(["Truck data", "Event log", "Assumptions"]);
    const eventRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Event log"]);
    expect(eventRows).toHaveLength(events);
    expect(
      eventRows.every(
        (r) => /^T[1-8]$/.test(String(r.truck)) && (!r.gate || /^G[12]$/.test(String(r.gate))),
      ),
    ).toBe(true);
    if (mode === "SmartMarsh") {
      expect([
        rows[0].arrival_min,
        rows[0].checked_in_min,
        rows[0].called_forward_min,
        rows[0].acknowledged_min,
        rows[0].at_gate_service_start_min,
        rows[0].service_end_min,
      ]).toEqual([0, 1, 4, 4.5, 7, 12]);
      await page.getByRole("button", { name: "View truck T1 events" }).click();
      await expect(page.getByRole("dialog")).toContainText("ACKNOWLEDGED");
      await expect(page.getByRole("dialog")).toContainText("PREPARING");
      await page.getByRole("button", { name: "Close truck details" }).click();
    }
  }
  await page.getByLabel("Search trucks").fill("no-such-truck");
  await expect(page.getByText("No trucks found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Filter trucks by state").selectOption("COMPLETED");
  await expect(page.locator(".truck-table tbody tr")).toHaveCount(8);
});

test("event log exposes modeled T1 timestamps, filters, pagination and separate preview telemetry", async ({
  page,
}) => {
  await page.goto("/");
  await seek(page, 4);
  await page.getByRole("button", { name: "Acknowledge notification", exact: true }).click();
  await navigate(page, "Analytics Dashboard");
  await navigate(page, "Simulation");
  await expect(page.getByRole("button", { name: "Notification acknowledged" })).toBeDisabled();
  await seek(page, 4.5);
  await page.getByLabel("Filter event category").selectOption("acknowledged");
  await expect(page.locator(".event-row")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export event log CSV" }).click();
  const acknowledgements = csvRows(await readFile((await (await download).path())!, "utf8"));
  expect(acknowledgements.map((r) => [r.time_min, r.source])).toEqual([
    [4.5, "SIMULATION"],
    [4, "DRIVER PREVIEW"],
  ]);
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(page.locator(".event-row")).toHaveCount(0);
  await seek(page, 42);
  await page.getByLabel("Filter event category").selectOption("all");
  await expect(page.locator(".event-pagination")).toContainText("1–20 of 80 records");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next event page" }).click();
  await expect(page.locator(".event-pagination")).toContainText("61–80 of 80 records");
  await page.getByLabel("Filter event log", { exact: true }).selectOption("selected");
  await expect(page.locator(".event-row")).toHaveCount(10);
  const traceDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export event log CSV" }).click();
  const trace = csvRows(await readFile((await (await traceDownload).path())!, "utf8")).reverse();
  expect(trace.map((r) => [r.time_min, r.state])).toEqual([
    [0, "ARRIVED"],
    [1, "CHECKED IN"],
    [1, "WAIT ENGINE OFF"],
    [4, "CALLED FORWARD"],
    [4.5, "ACKNOWLEDGED"],
    [4.5, "PREPARING"],
    [5, "MOVING"],
    [7, "AT GATE"],
    [7, "SERVICE"],
    [12, "COMPLETED"],
  ]);
});

test("legacy settings cannot restore extra trucks or gates; only playback and environmental factors are editable", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "smartmarsh-settings-v1",
      JSON.stringify({
        trucks: 100,
        gates: 10,
        seed: 1,
        travelTime: 8,
        checkInTime: 7,
        speed: 2,
        idleRate: 2.5,
        co2Factor: 2.68,
      }),
    ),
  );
  await page.reload();
  await expect(page.locator(".gate-row")).toHaveCount(2);
  await navigate(page, "Settings");
  await expect(page.getByLabel("Number of trucks", { exact: true })).toHaveValue("8");
  await expect(page.getByLabel("Number of trucks", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(page.getByLabel("Service gates", { exact: true })).toHaveValue("2");
  await page.getByLabel("Playback speed", { exact: true }).fill("99");
  await page.getByRole("button", { name: "Save & apply settings" }).click();
  await expect(page.getByText("Enter a number from 0.5 to 20.")).toBeVisible();
  for (const [label, value] of [
    ["Playback speed", "5"],
    ["Diesel idle consumption", "3"],
    ["Diesel CO₂ factor", "2.5"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Save & apply settings" }).click();
  await page.reload();
  await expect(page.getByLabel("Playback speed", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Diesel idle consumption", { exact: true })).toHaveValue("3");
  await navigate(page, "Simulation");
  await page.getByRole("button", { name: "Run paired comparison", exact: true }).click();
  await expect(page.locator(".analytics-kpis .kpi").nth(2)).toContainText("4.0");
  await navigate(page, "Settings");
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await page.getByRole("button", { name: "Save & apply settings" }).click();
  await navigate(page, "Simulation");
  await expect(page.getByRole("slider", { name: "Simulation timeline" })).toHaveValue("0");
  await expect(page.locator(".gate-row .badge")).toHaveText(["BUSY", "BUSY"]);
});

test("all six existing pages retain mobile navigation and have no viewport overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const [name, heading] of [
    ["About the Project", "About the project"],
    ["Settings", "Simulation settings"],
    ["Results & Conclusions", "Results & conclusions"],
    ["Truck Data Table", "Truck data register"],
    ["Analytics Dashboard", "Analytics dashboard"],
    ["Simulation", title],
  ]) {
    await navigate(page, name);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test("partial snapshots hide future traces and empty workbook exports retain their schema", async ({
  page,
}) => {
  await page.goto("/#analytics");
  for (const index of [1, 5, 6, 7])
    await expect(
      page.locator(".analytics-kpis .kpi").nth(index).locator(".kpi-value"),
    ).toContainText("—");
  await navigate(page, "Truck Data Table");
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const rows = csvRows(await readFile((await (await waiting).path())!, "utf8"));
  expect(rows).toHaveLength(8);
  for (const row of rows)
    for (const key of [
      "gate",
      "checked_in_min",
      "called_forward_min",
      "acknowledged_min",
      "service_end_min",
      "turnaround_min",
    ])
      expect(row[key]).toBe("");
  await page.getByLabel("Search trucks").fill("no-match");
  const empty = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export XLSX", exact: true }).click();
  const book = XLSX.read(await readFile((await (await empty).path())!));
  const data = XLSX.utils.sheet_to_json<string[]>(book.Sheets["Truck data"], { header: 1 });
  expect(data).toHaveLength(1);
  expect(data[0]).toContain("acknowledged_min");
  expect(data[0]).toContain("at_gate_service_start_min");
  expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets["Event log"], { header: 1 })).toHaveLength(
    1,
  );
});
