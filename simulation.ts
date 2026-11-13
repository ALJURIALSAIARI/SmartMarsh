export type Mode = "smart" | "traditional";
export type TruckState =
  | "NOT ARRIVED"
  | "ARRIVED"
  | "CHECKED IN"
  | "WAIT ENGINE OFF"
  | "WAIT ENGINE ON"
  | "CALLED FORWARD"
  | "MOVING"
  | "AT GATE"
  | "SERVICE"
  | "COMPLETED";
export interface Settings {
  trucks: number;
  gates: number;
  serviceMean: number;
  arrivalInterval: number;
  travelTime: number;
  checkInTime: number;
  seed: number;
  speed: number;
  idleRate: number;
  co2Factor: number;
}
export const DEFAULTS: Settings = {
  trucks: 30,
  gates: 3,
  serviceMean: 8,
  arrivalInterval: 0.8,
  travelTime: 0.6,
  checkInTime: 0.4,
  seed: 42,
  speed: 2,
  idleRate: 2.5,
  co2Factor: 2.68,
};
export const LIMITS: Record<keyof Settings, [number, number]> = {
  trucks: [5, 100],
  gates: [1, 10],
  serviceMean: [0.5, 60],
  arrivalInterval: [0.05, 30],
  travelTime: [0.05, 10],
  checkInTime: [0, 10],
  seed: [0, 2147483647],
  speed: [0.5, 20],
  idleRate: [0.1, 10],
  co2Factor: [0.1, 5],
};
export function validSettings(value: unknown): Settings {
  const result = { ...DEFAULTS };
  if (!value || typeof value !== "object") return result;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = Number((value as Record<string, unknown>)[key]);
    if (Number.isFinite(v)) result[key] = Math.min(LIMITS[key][1], Math.max(LIMITS[key][0], v));
  }
  result.trucks = Math.round(result.trucks);
  result.gates = Math.round(result.gates);
  result.seed = Math.round(result.seed);
  return result;
}
export interface Truck {
  id: number;
  arrival: number;
  serviceDuration: number;
  checkedIn: number;
  called: number;
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
/** In-memory driver-preview telemetry; never used to calculate simulation outcomes. */
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
}
export const REACTION_TIME = 0.1;
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function generateInputs(settings: Settings) {
  const rng = random(settings.seed);
  let arrival = 0;
  return Array.from({ length: settings.trucks }, (_, i) => {
    if (i) arrival += -Math.log(1 - rng()) * settings.arrivalInterval;
    return { id: i + 1, arrival, serviceDuration: settings.serviceMean * (0.6 + rng() * 0.8) };
  });
}
/** Event queue advances only to check-in and completion events. Gates are reserved
 * atomically at dispatch and cannot be reused until their completion event. */
export function simulate(settings: Settings, mode: Mode): Run {
  const trucks: Truck[] = generateInputs(settings).map((t) => ({
    ...t,
    checkedIn: t.arrival + settings.checkInTime,
    called: Infinity,
    moving: Infinity,
    atGate: Infinity,
    serviceEnd: Infinity,
    gate: -1,
  }));
  const events: SimEvent[] = [];
  const add = (t: Truck, time: number, state: TruckState, message: string) =>
    events.push({
      time,
      state,
      message,
      truck: t.id,
      gate: t.gate < 0 ? undefined : t.gate,
      seq: events.length,
    });
  type InternalEvent = { time: number; kind: "ready" | "done"; truck: Truck };
  const pending: InternalEvent[] = trucks.map((t) => ({
    time: t.checkedIn,
    kind: "ready",
    truck: t,
  }));
  const free = Array.from({ length: settings.gates }, () => true);
  const waiting: Truck[] = [];
  trucks.forEach((t) => add(t, t.arrival, "ARRIVED", "Arrived at terminal · check-in started"));
  while (pending.length) {
    pending.sort(
      (a, b) =>
        a.time - b.time ||
        (a.kind === "done" ? -1 : 1) - (b.kind === "done" ? -1 : 1) ||
        a.truck.id - b.truck.id,
    );
    const next = pending.shift()!;
    const t = next.truck;
    if (next.kind === "done") {
      free[t.gate] = true;
      add(t, next.time, "COMPLETED", `Service complete · gate G${t.gate + 1} released`);
    } else {
      add(t, next.time, "CHECKED IN", "Check-in complete");
      add(
        t,
        next.time,
        mode === "smart" ? "WAIT ENGINE OFF" : "WAIT ENGINE ON",
        mode === "smart"
          ? "Staging bay assigned · switch engine off"
          : "Joined gate queue · engine remains on",
      );
      waiting.push(t);
      waiting.sort((a, b) => a.checkedIn - b.checkedIn || a.id - b.id);
    }
    let gate: number;
    while (waiting.length && (gate = free.indexOf(true)) !== -1) {
      const truck = waiting.shift()!;
      free[gate] = false;
      truck.gate = gate;
      truck.called = next.time;
      truck.moving = next.time + (mode === "smart" ? REACTION_TIME : 0);
      truck.atGate = truck.moving + settings.travelTime;
      truck.serviceEnd = truck.atGate + truck.serviceDuration;
      add(truck, truck.called, "CALLED FORWARD", `G${gate + 1} exclusively reserved · GO TO GATE`);
      add(truck, truck.moving, "MOVING", `Travelling to gate G${gate + 1} · not idling`);
      add(truck, truck.atGate, "AT GATE", `Arrived at gate G${gate + 1}`);
      add(truck, truck.atGate, "SERVICE", `Service started at G${gate + 1} · engine off`);
      pending.push({ time: truck.serviceEnd, kind: "done", truck });
    }
  }
  events.sort((a, b) => a.time - b.time || a.seq - b.seq);
  return {
    mode,
    settings: { ...settings },
    trucks,
    events,
    duration: Math.max(...trucks.map((t) => t.serviceEnd)),
  };
}
export function stateAt(t: Truck, time: number, mode: Mode): TruckState {
  if (time < t.arrival) return "NOT ARRIVED";
  if (time >= t.serviceEnd) return "COMPLETED";
  if (time >= t.atGate) return "SERVICE";
  if (time >= t.moving) return "MOVING";
  if (time >= t.called) return "CALLED FORWARD";
  if (time >= t.checkedIn) return mode === "smart" ? "WAIT ENGINE OFF" : "WAIT ENGINE ON";
  return "ARRIVED";
}
const elapsed = (start: number, end: number, now: number) =>
  Math.max(0, Math.min(end, now) - start);
export function idleMinutes(t: Truck, mode: Mode, time: number) {
  return (
    elapsed(t.arrival, t.checkedIn, time) +
    (mode === "traditional" ? elapsed(t.checkedIn, t.moving, time) : 0)
  );
}
export function metrics(run: Run, time = run.duration) {
  const now = Math.min(time, run.duration);
  const done = run.trucks.filter((t) => t.serviceEnd <= now);
  const arrived = run.trucks.filter((t) => t.arrival <= now);
  const idle = run.trucks.reduce((sum, t) => sum + idleMinutes(t, run.mode, now), 0);
  const fuel = (idle / 60) * run.settings.idleRate;
  const busy = run.trucks.reduce((sum, t) => sum + elapsed(t.atGate, t.serviceEnd, now), 0);
  const queue = run.trucks.filter((t) => t.checkedIn <= now && t.called > now).length;
  const mean = (fn: (t: Truck) => number) =>
    done.length ? done.reduce((sum, t) => sum + fn(t), 0) / done.length : 0;
  const maxQueue = Math.max(
    0,
    ...run.events
      .filter((e) => e.time <= now)
      .map((e) => run.trucks.filter((t) => t.checkedIn <= e.time && t.called > e.time).length),
  );
  return {
    completed: done.length,
    arrived: arrived.length,
    idle,
    fuel,
    co2: fuel * run.settings.co2Factor,
    turnaround: mean((t) => t.serviceEnd - t.arrival),
    waiting: mean((t) => t.called - t.checkedIn),
    utilization: now > 0 ? (busy / (run.settings.gates * now)) * 100 : 0,
    throughput: now > 0 ? (done.length / now) * 60 : 0,
    queue,
    maxQueue,
    horizon: now,
    busy: run.trucks.filter((t) => t.atGate <= now && t.serviceEnd > now).length,
  };
}
export function gateAt(run: Run, gate: number, time: number) {
  const truck = run.trucks.find((t) => t.gate === gate && t.called <= time && t.serviceEnd > time);
  return { truck, status: truck ? (time >= truck.atGate ? "BUSY" : "RESERVED") : "AVAILABLE" };
}
export function clock(minutes: number) {
  if (!Number.isFinite(minutes)) return "—";
  const seconds = Math.floor(minutes * 60);
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export const fixed = (n: number, digits = 1) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
