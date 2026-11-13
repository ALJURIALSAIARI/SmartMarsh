import assert from "node:assert/strict";
import { createCsv } from "./csv";
import {
  DEFAULTS,
  simulate,
  metrics,
  idleMinutes,
  stateAt,
  generateInputs,
  REACTION_TIME,
  validSettings,
} from "./simulation";

for (const seed of [0, 42, 129, 99999]) {
  for (const gates of [1, 3, 10]) {
    const s = { ...DEFAULTS, seed, gates, trucks: 100 };
    const smart = simulate(s, "smart");
    const traditional = simulate(s, "traditional");
    assert.deepEqual(simulate(s, "smart"), smart, "deterministic replay");
    assert.deepEqual(
      smart.trucks.map((t) => [t.arrival, t.serviceDuration]),
      traditional.trucks.map((t) => [t.arrival, t.serviceDuration]),
    );
    for (const run of [smart, traditional]) {
      for (let gate = 0; gate < gates; gate++) {
        const assigned = run.trucks
          .filter((t) => t.gate === gate)
          .sort((a, b) => a.called - b.called);
        assigned.forEach((t, i) => {
          if (i) assert.ok(t.called >= assigned[i - 1].serviceEnd, "no overlapping reservations");
          assert.equal(t.atGate - t.moving > 0, true);
          assert.ok(Math.abs(t.atGate - t.moving - s.travelTime) < 1e-9);
          assert.ok(t.called >= t.checkedIn);
          assert.equal(stateAt(t, t.serviceEnd, run.mode), "COMPLETED");
        });
      }
      const dispatch = [...run.trucks].sort((a, b) => a.called - b.called || a.id - b.id);
      assert.deepEqual(
        dispatch.map((t) => t.id),
        generateInputs(s).map((t) => t.id),
        "FCFS",
      );
      const m = metrics(run);
      const expectedBusy = run.trucks.reduce((sum, t) => sum + t.serviceDuration, 0);
      assert.ok(Math.abs(m.utilization - (expectedBusy / (gates * run.duration)) * 100) < 1e-9);
      const expectedTurnaround =
        run.trucks.reduce((sum, t) => sum + t.serviceEnd - t.arrival, 0) / s.trucks;
      assert.ok(Math.abs(m.turnaround - expectedTurnaround) < 1e-9);
      // Independent FCFS recurrence verifies the event queue's complete schedule.
      const available = Array.from({ length: gates }, () => 0);
      for (const input of generateInputs(s)) {
        const gate = available.indexOf(Math.min(...available));
        const called = Math.max(input.arrival + s.checkInTime, available[gate]);
        const actual = run.trucks[input.id - 1];
        assert.ok(
          Math.abs(actual.called - called) < 1e-9,
          "event schedule agrees with FCFS recurrence",
        );
        available[gate] =
          called +
          (run.mode === "smart" ? REACTION_TIME : 0) +
          s.travelTime +
          input.serviceDuration;
        assert.ok(Math.abs(actual.serviceEnd - available[gate]) < 1e-9);
      }
      assert.equal(m.completed, 100);
      assert.ok(m.utilization >= 0 && m.utilization <= 100);
      assert.equal(m.fuel, (m.idle / 60) * s.idleRate);
      assert.equal(m.co2, m.fuel * s.co2Factor);
      assert.equal(m.throughput, (100 / run.duration) * 60);
      for (const t of run.trucks) {
        assert.ok(
          Math.abs(
            idleMinutes(t, run.mode, run.duration) -
              (s.checkInTime + (run.mode === "traditional" ? t.called - t.checkedIn : 0)),
          ) < 1e-9,
        );
        assert.ok(
          Math.abs(idleMinutes(t, run.mode, t.atGate) - idleMinutes(t, run.mode, t.moving)) < 1e-9,
          "travel never idles",
        );
        assert.ok(
          Math.abs(t.moving - t.called - (run.mode === "smart" ? REACTION_TIME : 0)) < 1e-9,
        );
      }
      assert.equal(metrics(run, 0).completed, 0);
    }
    assert.ok(metrics(smart).idle <= metrics(traditional).idle + 1e-9);
  }
}
const zeroCheck = simulate({ ...DEFAULTS, checkInTime: 0 }, "smart");
assert.equal(metrics(zeroCheck).idle, 0);
assert.equal(validSettings({ trucks: 1000, gates: -1 }).trucks, 100);
assert.equal(validSettings({ trucks: 1000, gates: -1 }).gates, 1);
assert.deepEqual(
  generateInputs({ ...DEFAULTS, speed: 20 }),
  generateInputs(DEFAULTS),
  "speed has no engineering effect",
);
const base = simulate(DEFAULTS, "traditional");
const changedFactors = simulate(
  {
    ...DEFAULTS,
    idleRate: DEFAULTS.idleRate * 2,
    co2Factor: DEFAULTS.co2Factor * 1.5,
  },
  "traditional",
);
assert.deepEqual(
  changedFactors.trucks,
  base.trucks,
  "environmental factors never alter operations",
);
assert.ok(Math.abs(metrics(changedFactors).fuel - metrics(base).fuel * 2) < 1e-9);
assert.ok(Math.abs(metrics(changedFactors).co2 - metrics(base).co2 * 3) < 1e-9);
assert.deepEqual(simulate({ ...DEFAULTS, speed: 20 }, "traditional").events, base.events);
const differentArrivals = generateInputs({
  ...DEFAULTS,
  arrivalInterval: DEFAULTS.arrivalInterval * 2,
});
const differentService = generateInputs({ ...DEFAULTS, serviceMean: DEFAULTS.serviceMean * 2 });
generateInputs(DEFAULTS).forEach((t, i) => {
  assert.ok(Math.abs(differentArrivals[i].arrival - t.arrival * 2) < 1e-9);
  assert.equal(differentArrivals[i].serviceDuration, t.serviceDuration);
  assert.ok(Math.abs(differentService[i].serviceDuration - t.serviceDuration * 2) < 1e-9);
  assert.equal(differentService[i].arrival, t.arrival);
});
assert.notDeepEqual(generateInputs({ ...DEFAULTS, seed: 43 }), generateInputs(DEFAULTS));
const changedTimings = simulate({ ...DEFAULTS, travelTime: 2, checkInTime: 1 }, "smart");
for (const t of changedTimings.trucks) {
  assert.ok(Math.abs(t.checkedIn - t.arrival - 1) < 1e-9);
  assert.ok(Math.abs(t.atGate - t.moving - 2) < 1e-9);
}
for (const mode of ["smart", "traditional"] as const) {
  const sparse = simulate({ ...DEFAULTS, trucks: 5, gates: 10, checkInTime: 0 }, mode);
  assert.equal(sparse.trucks.length, 5);
  assert.equal(metrics(sparse).idle, 0, "no fabricated idling when there is no engine-on wait");
  assert.equal(metrics(sparse).fuel, 0);
  assert.equal(metrics(sparse).co2, 0);
}
assert.equal(
  createCsv(["event", "minutes"], [['Quoted "event",\nsecond line', 0.1234567890123456]]),
  '"event","minutes"\r\n"Quoted ""event"",\nsecond line","0.1234567890123456"',
  "CSV escapes commas, quotes and newlines without losing numerical precision",
);
console.log(
  "Passed: 12 paired scenarios / 2,400 trucks plus settings-sensitivity and zero-idling edge cases; deterministic replay, FCFS, gate exclusion, timestamps, metric equations, speed independence and CSV precision.",
);
