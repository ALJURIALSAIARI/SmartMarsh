# SmartMarsh Simulation

The original Simulation menu opens the appendix model directly. There is no
separate assignment page, tab, link or alternative random demo.

## Fixed inputs and timing (minutes)

- Tracked trucks: T1–T8. Gates: G1 and G2.
- Arrivals: `[0, 1, 2, 4, 7, 8, 11, 14]`.
- Service durations: `[5, 6, 4, 7, 5, 6, 4, 5]`.
- Initial gate release: G1 at 4, G2 at 6. Earlier traffic is not a tracked truck.
- Traditional: eligible at arrival; stationary engine-on queue; 1 minute travel.
- SmartMarsh: 1 minute moving to staging; engine-off queue; after call,
  0.5 minute engine-off acknowledgement, 0.5 minute stationary engine-on
  preparation, and 2 minutes travel to the gate.
- FCFS among eligible trucks. Input order breaks truck ties; G1 breaks gate
  ties at call time. A call reserves the gate exclusively through service finish.

`src/simulation.ts` generates the deterministic schedules and timestamped events.
The SVG terminal, gate monitor, driver view, live log, registers, charts, metrics,
CSV and XLSX all consume those same run objects.

Only playback speed, diesel idle rate and CO₂ factor are adjustable. Old saved
demand settings are ignored. Fresh loads and Reset always use the fixed model.
No accounts, server storage or remote services are used.

## Metric definitions and expected completed results

| Metric                                   | Traditional | SmartMarsh |
| ---------------------------------------- | ----------: | ---------: |
| Stationary engine-on time (truck-min)    |          69 |          4 |
| Mean eligible queue time (min/truck)     |       8.625 |     10.875 |
| Mean pre-service time (min/truck)        |       9.625 |     14.875 |
| Mean turnaround (min/truck)              |      14.875 |     20.125 |
| Final truck completion (min)             |          32 |         42 |
| Peak eligible queue (trucks)             |           4 |          4 |
| Pre-service gate reservations (gate-min) |           8 |         24 |
| Shared-window service utilization        |       61.9% |      61.9% |

Stationary engine-on time is arrival-to-call in Traditional and acknowledgement-
to-departure in SmartMarsh. Travel, service and engine-off waiting/response are
excluded. Queue wait is eligibility-to-call; pre-service is arrival-to-service;
turnaround is arrival-to-completion. Peak queue counts uncalled eligible trucks
after all calls at each timestamp.

The shared playback/observation window ends at the later completion, derived
from both schedules (42 minutes). Utilization includes 42 tracked service
minutes and 10 initial service gate-minutes: `52 / (2 × 42) × 100`.
Live partial snapshots use the same elapsed window in both policies, and means
include completed tracked trucks only.

Reduction in stationary engine-on time: `(69 − 4) / 69 × 100 = 94.2%` displayed.
Mean turnaround increases separately by `20.125 − 14.875 = 5.25 min/truck`.
All calculations retain full precision; rounding is display-only.

Fuel and CO₂ are simulated estimates for stationary engine-on time only.
Report defaults are 0.8 US gal/h and 10.21 kg CO₂/US gal, converted using
exactly 3.785411784 L/US gal. Calculations use `0.8 × 3.785411784` L/h and
`10.21 / 3.785411784` kg/L without rounding. The 65 truck-minutes avoided
correspond to approximately 3.28 L diesel and 8.85 kg CO₂ avoided.
Saved v1 settings migrate once to these defaults; later factor edits are
retained in v2 settings. Factors remain editable and never affect event timing.

SmartMarsh T1: arrival 0, eligibility 1, call/G1 reservation 4,
acknowledgement/preparation 4.5, departure 5, service start 7, completion 12.
Optional driver-preview clicks are labeled separately and never change the
modeled acknowledgement or schedule.

## Verification

For this standalone export, run `pnpm dev` in one terminal and the browser tests in another. See `README.md` for setup and GitHub Pages instructions.

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
pnpm build
```

Unit tests verify every expected metric, initial traffic, the complete T1 trace,
FCFS and gate exclusivity at quarter-minute snapshots, fixed settings migration,
and precision. Browser tests exercise the original homepage/menu, terminal and
log synchronization, both policies, desktop/mobile playback and navigation,
dashboard/charts, CSV/XLSX exports, driver-preview telemetry and settings.
`python3 scripts/export-github.py` refreshes the portable source ZIP and the
browser-download payload.
