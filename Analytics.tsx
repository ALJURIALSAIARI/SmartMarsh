import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Truck,
  Clock3,
  Timer,
  Fuel,
  Leaf,
  Gauge,
  TrendingUp,
  ListOrdered,
  CircleCheck,
  Hourglass,
  GitCompareArrows,
} from "lucide-react";
import { Badge, Button, Delta, Kpi, Panel } from "./components";
import { fixed, metrics, type Run } from "./simulation";

export interface PairProps {
  smart: Run;
  traditional: Run;
  time: number;
  onCompare: () => void;
}
export const compareRows = [
  { key: "completed", label: "Completed trucks", unit: "trucks", inverse: true },
  { key: "idle", label: "Stationary engine-on idling", unit: "min", inverse: false },
  { key: "fuel", label: "Idling diesel consumed", unit: "L", inverse: false },
  { key: "co2", label: "Idling CO₂ emissions", unit: "kg", inverse: false },
  { key: "waiting", label: "Mean staging / queue wait", unit: "min", inverse: false },
  { key: "turnaround", label: "Mean truck turnaround", unit: "min", inverse: false },
  { key: "utilization", label: "Gate service utilization", unit: "%", inverse: true },
  { key: "throughput", label: "Terminal throughput", unit: "trucks/h", inverse: true },
  { key: "maxQueue", label: "Maximum waiting queue", unit: "trucks", inverse: false },
  { key: "horizon", label: "Simulation horizon", unit: "min", inverse: false },
] as const;
export function ComparisonTable({ smart, traditional, time }: Omit<PairProps, "onCompare">) {
  const a = metrics(traditional, time),
    b = metrics(smart, time);
  return (
    <div className="table-scroll">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>PERFORMANCE INDICATOR</th>
            <th>
              <span className="legend-square traditional" />
              Traditional
            </th>
            <th className="smart-column">
              <span className="legend-square smart" />
              SmartMarsh
            </th>
            <th>CHANGE</th>
          </tr>
        </thead>
        <tbody>
          {compareRows.map((r) => {
            const mean = r.key === "waiting" || r.key === "turnaround";
            const rate = r.key === "utilization" || r.key === "throughput";
            const beforeAvailable = mean ? a.completed > 0 : !rate || a.horizon > 0;
            const afterAvailable = mean ? b.completed > 0 : !rate || b.horizon > 0;
            return (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>
                  {beforeAvailable ? (
                    <>
                      {fixed(a[r.key], r.key === "completed" || r.key === "maxQueue" ? 0 : 2)}{" "}
                      <small>{r.unit}</small>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="smart-column">
                  {afterAvailable ? (
                    <>
                      {fixed(b[r.key], r.key === "completed" || r.key === "maxQueue" ? 0 : 2)}{" "}
                      <small>{r.unit}</small>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {beforeAvailable && afterAvailable ? (
                    <Delta before={a[r.key]} after={b[r.key]} inverse={r.inverse} />
                  ) : (
                    <span className="neutral">
                      {mean ? "Awaiting completion" : "Awaiting elapsed time"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function ScopeNote({ smart, traditional, time, onCompare }: PairProps) {
  const complete = time >= Math.max(smart.duration, traditional.duration);
  return (
    <div className="scope-note">
      <div>
        <Badge tone={complete ? "green" : "blue"}>
          {complete ? "PAIRED RUN COMPLETE" : "LIVE PARTIAL SNAPSHOT"}
        </Badge>
        <span>
          {complete
            ? `Identical inputs · Seed ${smart.settings.seed} · ${smart.settings.trucks} trucks per mode`
            : "Values reflect events up to the current playback time, not a completed experiment."}
        </span>
      </div>
      {!complete && (
        <Button icon={GitCompareArrows} onClick={onCompare}>
          Complete paired run
        </Button>
      )}
    </div>
  );
}
const axis = { fontSize: 10, fill: "#86939f" };
const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e3eaee",
  fontSize: 12,
  boxShadow: "0 5px 20px #0b253a12",
};
const colors = { traditional: "#8d9fb0", smart: "#009c9a" };
export default function Analytics(p: PairProps) {
  const m = metrics(p.smart, p.time);
  const a = metrics(p.traditional, p.time);
  const end = Math.min(p.time, Math.max(p.smart.duration, p.traditional.duration));
  const queueTimes = Array.from(
    new Set([
      0,
      end,
      ...p.smart.events.filter((e) => e.time <= end).map((e) => e.time),
      ...p.traditional.events.filter((e) => e.time <= end).map((e) => e.time),
    ]),
  ).sort((a, b) => a - b);
  const queues = queueTimes.map((time) => ({
    time: Number(time.toFixed(3)),
    Traditional: p.traditional.trucks.filter((t) => t.checkedIn <= time && t.called > time).length,
    SmartMarsh: p.smart.trucks.filter((t) => t.checkedIn <= time && t.called > time).length,
  }));
  const completed = [...p.smart.trucks, ...p.traditional.trucks].filter(
    (t) => t.serviceEnd <= p.time,
  );
  const maxWait = Math.max(5, ...completed.map((t) => t.called - t.checkedIn));
  const width = Math.ceil(maxWait / 5);
  const histogram = Array.from({ length: 5 }, (_, i) => ({
    name: `${i * width}–${(i + 1) * width}`,
    Traditional: p.traditional.trucks.filter(
      (t) =>
        t.serviceEnd <= p.time &&
        t.called - t.checkedIn >= i * width &&
        (i === 4 || t.called - t.checkedIn < (i + 1) * width),
    ).length,
    SmartMarsh: p.smart.trucks.filter(
      (t) =>
        t.serviceEnd <= p.time &&
        t.called - t.checkedIn >= i * width &&
        (i === 4 || t.called - t.checkedIn < (i + 1) * width),
    ).length,
  }));
  const gates = Array.from({ length: p.smart.settings.gates }, (_, gate) => {
    const value = (run: Run) => {
      const horizon = Math.min(p.time, run.duration);
      return horizon
        ? (run.trucks
            .filter((t) => t.gate === gate)
            .reduce((sum, t) => sum + Math.max(0, Math.min(t.serviceEnd, horizon) - t.atGate), 0) /
            horizon) *
            100
        : 0;
    };
    return { name: `G${gate + 1}`, Traditional: value(p.traditional), SmartMarsh: value(p.smart) };
  });
  return (
    <>
      <ScopeNote {...p} />
      <div className="section-title">
        <div>
          <h2>Performance at a glance</h2>
          <p>SmartMarsh · metrics derived directly from simulation events</p>
        </div>
        <Badge tone="teal">10 CORE INDICATORS</Badge>
      </div>
      <div className="kpi-grid analytics-kpis">
        <Kpi
          title="Completed trucks"
          value={m.completed}
          unit={`/ ${p.smart.settings.trucks}`}
          icon={CircleCheck}
          detail="Service-end events recorded"
          accent="green"
        />
        <Kpi
          title="Mean turnaround"
          value={m.completed ? fixed(m.turnaround) : "—"}
          unit="min"
          icon={Timer}
          detail={m.completed ? "Service end − terminal arrival" : "No completed trips yet"}
          accent="blue"
        />
        <Kpi
          title="Engine-on idling"
          value={fixed(m.idle)}
          unit="min"
          icon={Clock3}
          detail="Check-in + engine-on queue time"
          accent="amber"
        />
        <Kpi
          title="Idling fuel"
          value={fixed(m.fuel, 2)}
          unit="L"
          icon={Fuel}
          detail={`Diesel idle rate: ${p.smart.settings.idleRate} L/h`}
        />
        <Kpi
          title="Idling CO₂"
          value={fixed(m.co2, 2)}
          unit="kg"
          icon={Leaf}
          detail={`Emission factor: ${p.smart.settings.co2Factor} kg/L`}
          accent="green"
        />
        <Kpi
          title="Mean waiting"
          value={m.completed ? fixed(m.waiting) : "—"}
          unit="min"
          icon={Hourglass}
          detail={m.completed ? "Check-in complete → dispatch" : "No completed trips yet"}
          accent="blue"
        />
        <Kpi
          title="Gate utilization"
          value={m.horizon > 0 ? fixed(m.utilization) : "—"}
          unit="%"
          icon={Gauge}
          detail={m.horizon > 0 ? "Service time / gate horizon" : "Clock has not advanced"}
        />
        <Kpi
          title="Throughput"
          value={m.horizon > 0 ? fixed(m.throughput) : "—"}
          unit="trucks/h"
          icon={TrendingUp}
          detail={m.horizon > 0 ? "Completed / elapsed hours" : "Clock has not advanced"}
          accent="green"
        />
        <Kpi
          title="Peak waiting queue"
          value={m.maxQueue}
          unit="trucks"
          icon={ListOrdered}
          detail="Maximum simultaneous waiters"
          accent="amber"
        />
        <Kpi
          title="Current waiting queue"
          value={m.queue}
          unit="trucks"
          icon={Truck}
          detail={`${m.busy} of ${p.smart.settings.gates} gates in service`}
          accent="blue"
        />
      </div>
      <Panel
        title="The environmental difference"
        subtitle="Stationary engine-on emissions only. Moving time and service are excluded."
        action={
          <div className="chart-legend">
            <span>
              <i className="traditional" />
              Traditional
            </span>
            <span>
              <i className="smart" />
              SmartMarsh
            </span>
          </div>
        }
      >
        <div className="environment-charts">
          {[
            { key: "idle", name: "Engine-on idling", unit: "min" },
            { key: "fuel", name: "Diesel consumed", unit: "L" },
            { key: "co2", name: "CO₂ emissions", unit: "kg" },
          ].map(({ key, name, unit }) => (
            <div className="mini-chart" key={key}>
              <h3>
                {name} <span>({unit})</span>
              </h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={[
                    { name: "Traditional", value: a[key as "idle"], fill: colors.traditional },
                    { name: "SmartMarsh", value: m[key as "idle"], fill: colors.smart },
                  ]}
                  margin={{ top: 14, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#edf0f2" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axis} />
                  <YAxis axisLine={false} tickLine={false} tick={axis} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${fixed(Number(v), 2)} ${unit}`, name]}
                    cursor={{ fill: "#edf6f8" }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={55}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </Panel>
      <div className="chart-grid">
        <Panel
          title="Waiting queue over time"
          subtitle="Checked-in trucks awaiting exclusive gate reservation"
        >
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={245}>
              <AreaChart data={queues} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="queueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#009c9a" stopOpacity=".23" />
                    <stop offset="1" stopColor="#009c9a" stopOpacity=".01" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, Math.max(1, end)]}
                  tickFormatter={(v) => `${Math.round(v)}m`}
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => `${fixed(Number(v))} min`}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area
                  dataKey="Traditional"
                  type="stepAfter"
                  stroke={colors.traditional}
                  fill="transparent"
                  strokeDasharray="4 3"
                  isAnimationActive={false}
                />
                <Area
                  dataKey="SmartMarsh"
                  type="stepAfter"
                  stroke={colors.smart}
                  fill="url(#queueFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Waiting time distribution"
          subtitle="Completed trucks · time from check-in to dispatch (min)"
        >
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={245}>
              <BarChart data={histogram} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar
                  dataKey="Traditional"
                  fill={colors.traditional}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="SmartMarsh"
                  fill={colors.smart}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Service utilization by gate"
          subtitle="Busy service time / elapsed available time · reservations are not service"
          className="full-width"
        >
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={gates} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fixed(Number(v))}%`} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar
                  dataKey="Traditional"
                  isAnimationActive={false}
                  fill={colors.traditional}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={50}
                />
                <Bar
                  dataKey="SmartMarsh"
                  isAnimationActive={false}
                  fill={colors.smart}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel
        title="Traditional vs. SmartMarsh"
        subtitle="Same seeded demand, service durations, gates and gate travel time. No invented efficiency gains."
      >
        <ComparisonTable {...p} />
        <div className="table-footnote">
          Completed-run metrics use each mode’s own clearance horizon. Live snapshots use the same
          elapsed time. Mean waiting and turnaround include completed trucks only.
        </div>
      </Panel>
    </>
  );
}
