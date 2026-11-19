import assert from "node:assert/strict";
import { createCsv } from "./csv";
import {
  ARRIVALS,
  SERVICE_DURATIONS,
  INITIAL_RELEASES,
  DEFAULTS,
  REPORT_FACTORS,
  simulate,
  metrics,
  idleMinutes,
  stateAt,
  gateAt,
  serviceMinutes,
  validSettings,
} from "./simulation";

const traditional = simulate(DEFAULTS, "traditional"),
  smart = simulate(DEFAULTS, "smart");
assert.deepEqual(REPORT_FACTORS, {
  litersPerUSGallon: 3.785411784,
  idleUSGallonsPerHour: 0.8,
  co2KgPerUSGallon: 10.21,
});
assert.equal(DEFAULTS.idleRate, 0.8 * 3.785411784);
assert.equal(DEFAULTS.co2Factor, 10.21 / 3.785411784);
const avoidedIdle = metrics(traditional).idle - metrics(smart).idle;
assert.equal(avoidedIdle, 65);
const avoidedFuel = metrics(traditional).fuel - metrics(smart).fuel;
const avoidedCo2 = metrics(traditional).co2 - metrics(smart).co2;
assert.ok(Math.abs(avoidedFuel - (65 / 60) * 0.8 * 3.785411784) < 1e-12);
assert.ok(Math.abs(avoidedCo2 - (65 / 60) * 0.8 * 10.21) < 1e-12);
assert.equal(avoidedFuel.toFixed(2), "3.28");
assert.equal(avoidedCo2.toFixed(2), "8.85");
for (const [run, expected] of [
  [traditional, [69, 8.625, 9.625, 14.875, 32, 4, 8]],
  [smart, [4, 10.875, 14.875, 20.125, 42, 4, 24]],
] as const) {
  const m = metrics(run);
  assert.deepEqual(
    [m.idle, m.waiting, m.preService, m.turnaround, m.lastCompletion, m.maxQueue, m.reservations],
    expected,
  );
  assert.equal(m.completed, 8);
  assert.equal(m.arrived, 8);
  assert.equal(m.horizon, 42);
  assert.equal(m.utilization, (52 / 84) * 100);
  assert.equal(m.utilization.toFixed(1), "61.9");
  assert.equal(m.fuel, (m.idle / 60) * DEFAULTS.idleRate);
  assert.equal(m.co2, m.fuel * DEFAULTS.co2Factor);
  assert.ok(Math.abs(m.fuel - (m.idle / 60) * 0.8 * 3.785411784) < 1e-12);
  assert.ok(Math.abs(m.co2 - (m.idle / 60) * 0.8 * 10.21) < 1e-12);
  const oldFactors = simulate({ ...DEFAULTS, idleRate: 2.5, co2Factor: 2.68 }, run.mode);
  assert.deepEqual(oldFactors.trucks, run.trucks, "factor correction never changes truck timings");
  assert.deepEqual(
    oldFactors.events,
    run.events,
    "factor correction never changes the event trace",
  );
  assert.deepEqual(
    run.trucks.map((t) => t.arrival),
    [...ARRIVALS],
  );
  assert.deepEqual(
    run.trucks.map((t) => t.serviceDuration),
    [...SERVICE_DURATIONS],
  );
  assert.deepEqual(simulate(DEFAULTS, run.mode), run, "deterministic replay");
  assert.deepEqual(
    [...run.trucks].sort((a, b) => a.called - b.called || a.id - b.id).map((t) => t.id),
    [1, 2, 3, 4, 5, 6, 7, 8],
    "FCFS",
  );
  for (let gate = 0; gate < 2; gate++) {
    assert.equal(gateAt(run, gate, 0).status, "BUSY");
    assert.equal(gateAt(run, gate, 0).initial, true);
    const assigned = run.trucks.filter((t) => t.gate === gate);
    assigned.forEach((t, i) =>
      assert.ok(
        t.called >= (i ? assigned[i - 1].serviceEnd : INITIAL_RELEASES[gate]),
        "no overlapping reservations",
      ),
    );
    assert.equal(gateAt(run, gate, run.comparisonWindow).status, "AVAILABLE");
    assert.equal(
      serviceMinutes(run, gate, run.comparisonWindow),
      INITIAL_RELEASES[gate] + assigned.reduce((sum, t) => sum + t.serviceDuration, 0),
    );
  }
  for (const t of run.trucks) {
    assert.equal(stateAt(t, t.serviceEnd, run.mode), "COMPLETED");
    assert.equal(t.atGate - t.moving, run.mode === "smart" ? 2 : 1);
    assert.equal(
      idleMinutes(t, run.mode, t.atGate),
      idleMinutes(t, run.mode, t.moving),
      "travel does not idle",
    );
    assert.equal(
      idleMinutes(t, run.mode, t.serviceEnd),
      idleMinutes(t, run.mode, t.atGate),
      "service does not idle",
    );
    assert.equal(idleMinutes(t, run.mode, 42), run.mode === "smart" ? 0.5 : t.called - t.arrival);
    assert.ok(
      run.events.some(
        (e) =>
          e.truck === t.id &&
          e.state === "CALLED FORWARD" &&
          e.time === t.called &&
          e.gate === t.gate,
      ),
    );
  }
  assert.ok(
    run.events.every((e) => e.truck >= 1 && e.truck <= 8 && (e.gate === undefined || e.gate < 2)),
  );
  for (let time = 0; time <= 42; time += 0.25) {
    const snapshot = metrics(run, time);
    assert.ok(snapshot.utilization >= 0 && snapshot.utilization <= 100);
    assert.ok(snapshot.completed <= 8 && snapshot.busy <= 2);
    for (let gate = 0; gate < 2; gate++)
      assert.ok(
        run.trucks.filter((t) => t.gate === gate && t.called <= time && time < t.serviceEnd)
          .length <= 1,
      );
  }
}
assert.equal(
  (((metrics(traditional).idle - metrics(smart).idle) / metrics(traditional).idle) * 100).toFixed(
    1,
  ),
  "94.2",
);
assert.equal(metrics(smart).turnaround - metrics(traditional).turnaround, 5.25);
assert.equal(smart.duration, 42);
assert.equal(traditional.duration, 32);
const t1 = smart.trucks[0];
assert.deepEqual(
  [t1.arrival, t1.checkedIn, t1.called, t1.acknowledged, t1.moving, t1.atGate, t1.serviceEnd],
  [0, 1, 4, 4.5, 5, 7, 12],
);
for (const [time, state, gate] of [
  [0, "ARRIVED", "BUSY"],
  [1, "WAIT ENGINE OFF", "BUSY"],
  [4, "CALLED FORWARD", "RESERVED"],
  [4.5, "PREPARING", "RESERVED"],
  [5, "MOVING", "RESERVED"],
  [7, "SERVICE", "BUSY"],
  [12, "COMPLETED", "RESERVED"],
] as const) {
  assert.equal(stateAt(t1, time, "smart"), state);
  assert.equal(gateAt(smart, 0, time).status, gate);
}
assert.equal(idleMinutes(t1, "smart", 4.5), 0, "acknowledgement is engine off");
assert.equal(
  idleMinutes(t1, "smart", 4.75),
  0.25,
  "partial stationary preparation accrues exactly",
);
assert.deepEqual(
  smart.events.filter((e) => e.truck === 1).map((e) => [e.time, e.state]),
  [
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
  ],
);
assert.deepEqual(
  traditional.trucks.filter((t) => t.called === 21).map((t) => [t.id, t.gate]),
  [
    [6, 0],
    [7, 1],
  ],
  "simultaneous gate release uses G1 first",
);
const legacy = validSettings({
  trucks: 100,
  gates: 10,
  seed: 123,
  travelTime: 9,
  checkInTime: 7,
  speed: 5,
  idleRate: 3,
  co2Factor: 2.5,
});
assert.deepEqual(legacy, { trucks: 8, gates: 2, speed: 5, idleRate: 3, co2Factor: 2.5 });
assert.deepEqual(
  simulate(legacy, "smart").trucks,
  smart.trucks,
  "stored legacy settings cannot change appendix inputs",
);
assert.deepEqual(
  simulate({ ...DEFAULTS, speed: 20 }, "smart").events,
  smart.events,
  "speed only affects playback",
);
const factors = simulate(
  { ...DEFAULTS, idleRate: DEFAULTS.idleRate * 2, co2Factor: DEFAULTS.co2Factor * 1.5 },
  "traditional",
);
assert.deepEqual(factors.trucks, traditional.trucks);
assert.ok(Math.abs(metrics(factors).co2 - metrics(traditional).co2 * 3) < 1e-9);
assert.deepEqual(validSettings(null), DEFAULTS);
assert.equal(
  createCsv(["event", "minutes"], [['Quoted "event",\nsecond line', 0.1234567890123456]]),
  '"event","minutes"\r\n"Quoted ""event"",\nsecond line","0.1234567890123456"',
);
console.log(
  "Passed: exact appendix metrics for both modes; T1 event trace; 8 trucks / 2 gates; initial service and shared utilization; 338 quarter-minute snapshots; FCFS and gate exclusion; report US-gallon conversions and 3.28 L / 8.85 kg avoided; unchanged event traces; speed/factor independence; CSV precision.",
);
