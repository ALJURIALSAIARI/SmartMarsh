# SmartMarsh

A browser-only, deterministic port-truck marshalling experiment built with React,
TypeScript, Tailwind CSS and Recharts.

**SIMULATED ASSUMPTIONS, NOT MEASURED PORT DATA.**

## Using the application

1. Open **Settings** to configure truck count, gates, distributions, timings,
   seed, playback speed and environmental factors. Save applies the inputs to
   both modes, resets playback and persists settings in this browser.
2. On **Simulation**, start, pause, resume, reset or scrub the event timeline.
   Switching modes displays the alternative at the same elapsed time.
   Select any visible truck, or use the driver selector, to inspect its journey.
   The event log exposes the complete history with pagination, truck/category
   filters and CSV export of all matching records, not just the visible page.
3. **Run paired comparison** computes and reveals both completed experiments
   instantly; it does not use playback speed to calculate results.
4. **Analytics Dashboard** provides ten KPIs, six charts and a paired table.
5. **Truck Data Table** supports search, state filters, every-column sorting,
   pagination and individual truck event timelines. CSV and native XLSX exports
   contain all filtered records, not only the current page. Future event times
   and gate assignments are withheld at live snapshots.
6. **Results & Conclusions** generates conclusions only after both runs complete,
   and supports printing/saving a report via the browser print dialog.
7. **About the Project** documents the model, equations and limitations.

## Deterministic discrete-event model

`src/simulation.ts` is independent of React and wall-clock playback:

- A Mulberry32 PRNG seeded by the configured integer produces an identical
  arrival time and service-duration input for each truck in both modes.
- First arrival is at zero. Subsequent interarrival times follow a seeded
  exponential distribution with the configured mean.
- Each service requirement is sampled uniformly between 60% and 140% of the
  configured mean. This is a distribution mean, not a forced sample average.
- Check-in is parallel and has a fixed configured duration in both modes.
- A time-ordered event queue processes check-in and service-completion events.
  Completions are processed before check-ins at the same timestamp.
- FCFS waiting trucks are assigned exclusively to currently free gates.
  A gate becomes **RESERVED** atomically at dispatch, **BUSY** at service start
  and is released at service completion. It cannot receive a second assignment
  before the first completes.
- SmartMarsh has a fixed six-second engine-off notification reaction delay.
  Traditional has no notification delay. Travel time is identical in both modes.
- Traditional engines stay on during check-in and queue waiting.
  SmartMarsh engines stay on only during check-in, then switch off while staging
  and reacting to the dispatch notification.
- Engines are off during service in both modes. Movement is never counted as idle.
- Driver acknowledgment is an interactive preview, not a change to the modeled
  reaction delay. Otherwise human click timing would invalidate determinism.
  Its timestamp is retained across page navigation, is labeled as driver-preview
  telemetry in the event log/export, and never contributes to engineering metrics.
  Reset and a new run clear acknowledgments; rewinding discards later acknowledgments.
- CHECKED IN and AT GATE are instantaneous events. The animated scene displays
  the positive-duration state at each timestamp, while the full event log retains
  these transitions.
- Playback speed is strictly a wall-clock presentation setting:
  1× equals one simulated minute per real second.

All scene positions, service progress, gate states, logs, exports and metrics
derive from this shared schedule.

## Metrics

Time is stored in minutes at full numerical precision; displayed HH:MM:SS clocks
are truncated to whole seconds.

- Turnaround = service end − arrival.
- Queue/staging wait = dispatch − check-in completion.
- Stationary engine-on idle = check-in time + engine-on queue wait.
- Idling diesel (L) = idle minutes / 60 × configured L/h.
- Idling CO₂ (kg) = diesel liters × configured kg/L.
- Gate utilization (%) = summed service time / (gate count × horizon) × 100.
- Throughput (trucks/h) = completed trucks / horizon × 60.
- Peak queue = maximum checked-in, not-yet-dispatched truck count over event times.

Live cumulative fuel/idling metrics include elapsed intervals for all trucks.
Mean wait and turnaround include completed trucks only. A live comparison uses
the same elapsed timestamp. Completed-run metrics use each mode's own final
clearance horizon, measured from the common time-zero first arrival.
Before any truck completes, mean waiting and turnaround are displayed as
unavailable (—), not as a fictitious zero-minute result. Table sorting keeps
unrevealed future events last in either direction without using their hidden values.
Throughput and utilization are likewise unavailable until a positive horizon elapses.

The model does **not** assume SmartMarsh improves waiting or turnaround. Its
notification response can make both worse and lower throughput/utilization;
generated conclusions explicitly report these effects.

## Scope

Staging is unlimited. Roads, check-in and staging do not block. Gates are identical.
No breakdowns, gate specialties, acceleration fuel, driving emissions, service
emissions, real-world driver response distributions or site-measured data are
modeled. Carbon results represent stationary idling only, not whole-trip savings.
Only settings are stored locally; experiment records remain in memory.

## Verification

For this standalone export, run `pnpm dev` in one terminal and the browser tests in another. See `README.md` for setup and GitHub Pages instructions.

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
pnpm build
pnpm format <changed-files>
```

Install a Playwright Chromium browser if required with
`pnpm exec playwright install chromium`. Browser tests target the existing server
at `http://localhost:3000`; set `PLAYWRIGHT_BASE_URL` to use another preview address.

Engine checks cover 12 paired 100-truck scenarios (2,400 truck journeys), seeded
reproducibility, shared inputs, independent FCFS schedule recurrence, exclusive
gate reservations, timestamp ordering, emissions equations, utilization,
turnaround, travel exclusion and speed independence.
Additional checks verify each operating/environmental setting, zero-idling
scenarios, and CSV quoting/full numerical precision.

Browser tests exercise playback, end-of-timeline precision, notifications,
acknowledgment, paired comparison, six charts, ten KPIs, settings validation and
persistence, search/sort/pagination, CSV content, native XLSX sheets and values,
report printing, all six navigation destinations and mobile viewport overflow.
They also verify acknowledgement retention, complete event-history pagination and
filtered exports, unavailable live averages, hidden future timestamps and the
preserved schema of empty workbooks.
