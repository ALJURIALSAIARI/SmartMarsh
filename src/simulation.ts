export type Mode = "smart" | "traditional";
export type TruckState =
  | "NOT ARRIVED"
  | "ARRIVED"
  | "CHECKED IN"
  | "WAIT ENGINE OFF"
  | "WAIT ENGINE ON"
  | "CALLED FORWARD"
  | "ACKNOWLEDGED"
  | "PREPARING"
  | "MOVING"
  | "AT GATE"
  | "SERVICE"
  | "COMPLETED";

export const ARRIVALS = [0, 1, 2, 4, 7, 8, 11, 14] as const;
export const SERVICE_DURATIONS = [5, 6, 4, 7, 5, 6, 4, 5] as const;
export const INITIAL_RELEASES = [4, 6] as const;
export const TIMING = {
  staging: 1,
  acknowledgment: 0.5,
  preparation: 0.5,
  smartTravel: 2,
  traditionalTravel: 1,
} as const;
export interface Settings {
  trucks: number;
  gates: number;
  speed: number;
  idleRate: number;
  co2Factor: number;
}
export const REPORT_FACTORS = {
  litersPerUSGallon: 3.785411784,
  idleUSGallonsPerHour: 0.8,
  co2KgPerUSGallon: 10.21,
} as const;
export const DEFAULTS: Settings = {
  trucks: 8,
  gates: 2,
  speed: 2,
  idleRate: REPORT_FACTORS.idleUSGallonsPerHour * REPORT_FACTORS.litersPerUSGallon,
  co2Factor: REPORT_FACTORS.co2KgPerUSGallon / REPORT_FACTORS.litersPerUSGallon,
};
export const LIMITS: Record<keyof Settings, [number, number]> = {
  trucks: [8, 8],
  gates: [2, 2],
  speed: [0.5, 20],
  idleRate: [0.1, 10],
  co2Factor: [0.1, 5],
};
/** Ignore legacy demand settings: the appendix schedule is fixed in both modes. */
export function validSettings(value: unknown): Settings {
  const result = { ...DEFAULTS };
  if (value && typeof value === "object") {
    for (const key of ["speed", "idleRate", "co2Factor"] as const) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v))
        result[key] = Math.min(LIMITS[key][1], Math.max(LIMITS[key][0], v));
    }
  }
  return result;
}
export interface Truck {
  id: number;
  arrival: number;
  serviceDuration: number;
  checkedIn: number;
  called: number;
  acknowledged: number | null;
  moving: number;
  atGate: number;
  serviceEnd: number;
  gate: number;
}
export interface SimEvent {
  time: number;
  truck: number;
  gate?: number;
  state: TruckState;
  message: string;
  seq: number;
}
/** Optional driver-preview telemetry; never changes the modeled acknowledgment. */
export interface DriverAcknowledgment {
  mode: Mode;
  truck: number;
  gate: number;
  time: number;
}
export interface Run {
  mode: Mode;
  settings: Settings;
  trucks: Truck[];
  events: SimEvent[];
  duration: number;
  comparisonWindow: number;
}
function schedule(mode: Mode): Truck[] {
  const free: number[] = [...INITIAL_RELEASES];
  // Fixed eligibility offsets preserve input order; input order also breaks arrival ties.
  return ARRIVALS.map((arrival, index) => {
    const smart = mode === "smart";
    const checkedIn = arrival + (smart ? TIMING.staging : 0);
    const calls = free.map((release) => Math.max(release, checkedIn));
    // When both gates are already free, compare call times, not old release times.
    const gate = calls.indexOf(Math.min(...calls));
    const called = calls[gate];
    const acknowledged = smart ? called + TIMING.acknowledgment : null;
    const moving = smart ? acknowledged! + TIMING.preparation : called;
    const atGate = moving + (smart ? TIMING.smartTravel : TIMING.traditionalTravel);
    const serviceEnd = atGate + SERVICE_DURATIONS[index];
    free[gate] = serviceEnd; // Exclusive reservation covers response, prep, travel and service.
    return {
      id: index + 1,
      arrival,
      checkedIn,
      gate,
      called,
      acknowledged,
      moving,
      atGate,
      serviceEnd,
      serviceDuration: SERVICE_DURATIONS[index],
    };
  });
}
export function simulate(settings: Settings, mode: Mode): Run {
  const trucks = schedule(mode);
  const events: SimEvent[] = [];
  const add = (t: Truck, time: number, state: TruckState, message: string, gate = false) =>
    events.push({
      time,
      state,
      message,
      truck: t.id,
      gate: gate ? t.gate : undefined,
      seq: events.length,
    });
  for (const t of trucks) {
    add(
      t,
      t.arrival,
      "ARRIVED",
      mode === "smart"
        ? "Arrived at terminal · travelling to staging"
        : "Arrived at terminal · eligible for queue",
    );
    add(
      t,
      t.checkedIn,
      "CHECKED IN",
      mode === "smart"
        ? "Staging eligibility reached · engine off"
        : "Queue eligibility reached at arrival",
    );
    add(
      t,
      t.checkedIn,
      mode === "smart" ? "WAIT ENGINE OFF" : "WAIT ENGINE ON",
      mode === "smart"
        ? "Waiting in staging · engine off"
        : "Joined gate queue · engine remains on",
    );
    add(t, t.called, "CALLED FORWARD", `G${t.gate + 1} exclusively reserved · GO TO GATE`, true);
    if (t.acknowledged !== null) {
      add(
        t,
        t.acknowledged,
        "ACKNOWLEDGED",
        `Modeled acknowledgement · G${t.gate + 1} remains reserved`,
        true,
      );
      add(
        t,
        t.acknowledged,
        "PREPARING",
        "Stationary engine-on preparation started · 0.5 min",
        true,
      );
    }
    add(t, t.moving, "MOVING", `Travelling to gate G${t.gate + 1} · not stationary idling`, true);
    add(t, t.atGate, "AT GATE", `Arrived at gate G${t.gate + 1}`, true);
    add(t, t.atGate, "SERVICE", `Service started at G${t.gate + 1} · engine off`, true);
    add(t, t.serviceEnd, "COMPLETED", `Service complete · gate G${t.gate + 1} released`, true);
  }
  events.sort((a, b) => a.time - b.time || a.seq - b.seq);
  return {
    mode,
    settings: validSettings(settings),
    trucks,
    events,
    duration: Math.max(...trucks.map((t) => t.serviceEnd)),
    comparisonWindow: Math.max(
      ...trucks.map((t) => t.serviceEnd),
      ...schedule(mode === "smart" ? "traditional" : "smart").map((t) => t.serviceEnd),
    ),
  };
}
export function stateAt(t: Truck, time: number, mode: Mode): TruckState {
  if (time < t.arrival) return "NOT ARRIVED";
  if (time >= t.serviceEnd) return "COMPLETED";
  if (time >= t.atGate) return "SERVICE";
  if (time >= t.moving) return "MOVING";
  if (t.acknowledged !== null && time >= t.acknowledged) return "PREPARING";
  if (time >= t.called) return "CALLED FORWARD";
  if (time >= t.checkedIn) return mode === "smart" ? "WAIT ENGINE OFF" : "WAIT ENGINE ON";
  return "ARRIVED";
}
const elapsed = (start: number, end: number, now: number) =>
  Math.max(0, Math.min(end, now) - start);
export function idleMinutes(t: Truck, mode: Mode, time: number) {
  return mode === "smart"
    ? elapsed(t.acknowledged!, t.moving, time)
    : elapsed(t.arrival, t.called, time);
}
export function serviceMinutes(run: Run, gate: number, time: number) {
  return (
    Math.min(time, INITIAL_RELEASES[gate]) +
    run.trucks
      .filter((t) => t.gate === gate)
      .reduce((sum, t) => sum + elapsed(t.atGate, t.serviceEnd, time), 0)
  );
}
export function metrics(run: Run, time = run.comparisonWindow) {
  const now = Math.max(0, Math.min(time, run.comparisonWindow));
  const done = run.trucks.filter((t) => t.serviceEnd <= now);
  const idle = run.trucks.reduce((sum, t) => sum + idleMinutes(t, run.mode, now), 0);
  const fuel = (idle / 60) * run.settings.idleRate;
  const busyTime = INITIAL_RELEASES.reduce(
    (sum, _, gate) => sum + serviceMinutes(run, gate, now),
    0,
  );
  const mean = (fn: (t: Truck) => number) =>
    done.length ? done.reduce((sum, t) => sum + fn(t), 0) / done.length : 0;
  const queueAt = (time: number) =>
    run.trucks.filter((t) => t.checkedIn <= time && t.called > time).length;
  return {
    completed: done.length,
    arrived: run.trucks.filter((t) => t.arrival <= now).length,
    idle,
    fuel,
    co2: fuel * run.settings.co2Factor,
    turnaround: mean((t) => t.serviceEnd - t.arrival),
    waiting: mean((t) => t.called - t.checkedIn),
    preService: mean((t) => t.atGate - t.arrival),
    reservations: run.trucks.reduce((sum, t) => sum + elapsed(t.called, t.atGate, now), 0),
    lastCompletion: Math.max(0, ...done.map((t) => t.serviceEnd)),
    utilization: now > 0 ? (busyTime / (run.settings.gates * now)) * 100 : 0,
    throughput: now > 0 ? (done.length / now) * 60 : 0,
    queue: queueAt(now),
    maxQueue: Math.max(0, ...run.events.filter((e) => e.time <= now).map((e) => queueAt(e.time))),
    horizon: now,
    busy: INITIAL_RELEASES.filter((_, gate) => gateAt(run, gate, now).status === "BUSY").length,
  };
}
export function gateAt(run: Run, gate: number, time: number) {
  const truck = run.trucks.find((t) => t.gate === gate && t.called <= time && t.serviceEnd > time);
  const initial = time < INITIAL_RELEASES[gate];
  return {
    truck,
    initial,
    status: truck ? (time >= truck.atGate ? "BUSY" : "RESERVED") : initial ? "BUSY" : "AVAILABLE",
  };
}
export function clock(minutes: number) {
  if (!Number.isFinite(minutes)) return "—";
  const seconds = Math.floor(minutes * 60);
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export const fixed = (n: number, digits = 1) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
