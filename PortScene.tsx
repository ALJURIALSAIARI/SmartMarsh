import { gateAt, stateAt, type Run, type Truck } from "./simulation";

const gateY = (gate: number, count: number) =>
  217 + gate * Math.min(88, 253 / Math.max(1, count - 1));
function bay(t: Truck, count: number): [number, number] {
  const cols = count > 50 ? 10 : 6;
  const rows = Math.ceil(count / cols);
  return [
    260 + ((t.id - 1) % cols) * (count > 50 ? 36 : 55),
    228 + Math.floor((t.id - 1) / cols) * Math.min(37, 170 / rows),
  ];
}
function onPath(points: [number, number][], progress: number): [number, number] {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let dist = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (dist <= lengths[i]) {
      const f = lengths[i] ? dist / lengths[i] : 1;
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * f,
        points[i][1] + (points[i + 1][1] - points[i][1]) * f,
      ];
    }
    dist -= lengths[i];
  }
  return points[points.length - 1];
}
export default function PortScene({
  run,
  time,
  selected,
  onSelect,
}: {
  run: Run;
  time: number;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const cols = run.settings.trucks > 50 ? 10 : 6;
  return (
    <svg
      className="port-svg"
      viewBox="0 0 1000 515"
      role="img"
      aria-label={`Animated ${run.mode === "smart" ? "SmartMarsh staging" : "traditional queue"} terminal; select a truck to inspect its driver view`}
    >
      <defs>
        <pattern id="water" width="65" height="20" patternUnits="userSpaceOnUse">
          <path d="M8 10h25m9 0h9" stroke="#9ccbd4" strokeWidth="1" opacity=".6" />
        </pattern>
        <pattern id="concrete" width="25" height="25" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r=".6" fill="#c9d2d7" />
        </pattern>
        <pattern id="container" width="7" height="12" patternUnits="userSpaceOnUse">
          <path d="M3 0v12" stroke="#ffffff" opacity=".16" strokeWidth="1" />
        </pattern>
        <filter id="truck-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#163347" floodOpacity=".19" />
        </filter>
      </defs>
      <rect width="1000" height="515" fill="#edf1f2" />
      <rect width="1000" height="102" fill="#b9dce4" />
      <rect width="1000" height="102" fill="url(#water)" />
      <path d="M0 85H1000" stroke="#d6edf0" strokeWidth="2" />
      <text x="25" y="31" className="scene-label" fill="#588b9b" letterSpacing="3">
        TERMINAL WATERS
      </text>
      <g transform="translate(335,-14)">
        <path d="M0 31L30 12H340L372 30L349 75H29Z" fill="#234b62" />
        <path d="M29 75H349L355 65H20Z" fill="#16364b" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x={35 + i * 25}
            y="25"
            width="23"
            height="28"
            rx="1"
            fill={["#e5a66e", "#5e9597", "#dae1df", "#b6775b"][i % 4]}
          />
        ))}
        <rect x="308" y="5" width="31" height="18" rx="2" fill="#f5f7f6" />
        <rect x="317" y="0" width="5" height="8" fill="#d1d9da" />
      </g>
      <rect y="102" width="1000" height="57" fill="#d7dfe2" />
      <path d="M0 106h1000M0 150h1000" stroke="#a8b7bf" strokeWidth="3" />
      {[258, 500, 742].map((x, i) => (
        <g key={x} transform={`translate(${x},53)`}>
          <path
            d="M-25 95V0H80V95M-25 12H80M-20 89L74 8M-20 8L74 89"
            fill="none"
            stroke="#3d7384"
            strokeWidth="7"
          />
          <path d="M-38 4H112M88 4V58" stroke="#508b9b" strokeWidth="6" />
          <rect x="79" y="57" width="19" height="7" rx="2" fill="#244c60" />
          <rect x="-37" y="91" width="27" height="10" fill="#294a5a" />
          <rect x="66" y="91" width="27" height="10" fill="#294a5a" />
          <text x="23" y="42" fontSize="10" fontWeight="700" fill="#dcebee">
            QC-0{i + 1}
          </text>
        </g>
      ))}
      <rect y="162" width="1000" height="353" fill="url(#concrete)" />
      <path d="M0 454H752V184" stroke="#a4afb7" strokeWidth="71" fill="none" />
      <path d="M0 454H752V184" stroke="#637781" strokeWidth="62" fill="none" />
      <path
        d="M0 454H752V184"
        stroke="#e3e8e8"
        strokeWidth="1.5"
        strokeDasharray="13 12"
        fill="none"
      />
      <path d="M0 420H718M786 184V490" stroke="#e7bd70" strokeWidth="2" />
      {[100, 345, 610].map((x) => (
        <path
          key={x}
          d={`M${x} 440h17m-6-5 6 5-6 5`}
          stroke="#e7eeee"
          strokeWidth="2"
          fill="none"
        />
      ))}
      <text
        x="425"
        y="490"
        textAnchor="middle"
        className="scene-label"
        fill="#82929c"
        letterSpacing="2"
      >
        ONE-WAY TERMINAL ACCESS ROAD
      </text>
      <rect x="32" y="237" width="139" height="116" rx="5" fill="#dce4e5" stroke="#cad5d9" />
      <rect x="45" y="252" width="112" height="54" rx="3" fill="#f7faf9" stroke="#aabcc4" />
      <path d="M43 251H160L151 240H53Z" fill="#3f6473" />
      <rect x="58" y="263" width="27" height="19" fill="#b1d1d9" />
      <rect x="92" y="263" width="27" height="19" fill="#b1d1d9" />
      <rect x="128" y="269" width="15" height="37" fill="#6e8b96" />
      <text x="101" y="328" textAnchor="middle" className="scene-label" fill="#496273">
        CHECK-IN
      </text>
      <path d="M100 354v64" stroke="#bbc8cd" strokeWidth="35" />
      <path d="M100 357v62" stroke="#f7f9f8" strokeDasharray="5 6" />
      <g transform="translate(205,185)">
        <rect width="430" height="27" rx="4" fill={run.mode === "smart" ? "#deedeb" : "#e4e8ea"} />
        <circle cx="16" cy="13" r="4" fill={run.mode === "smart" ? "#009c9a" : "#84949d"} />
        <text x="29" y="17" className="scene-label" fill="#4b6c75" letterSpacing="1.3">
          {run.mode === "smart" ? "SMART STAGING · ENGINE-OFF ZONE" : "STAGING AREA · NOT USED"}
        </text>
      </g>
      {Array.from({ length: run.settings.trucks }, (_, i) => {
        const [x, y] = bay({ id: i + 1 } as Truck, run.settings.trucks);
        return (
          <g key={i} opacity={run.mode === "traditional" ? 0.35 : 1}>
            <rect
              x={x - 23}
              y={y - 10}
              width={cols === 10 ? 32 : 48}
              height={run.settings.trucks > 50 ? 16 : 27}
              rx="2"
              fill="#e1e7e7"
              stroke="#c5d0d2"
              strokeWidth="1"
            />
            <text
              x={x - 20}
              y={y + (run.settings.trucks > 50 ? 3 : 11)}
              fontSize="6"
              fill="#9cabb2"
            >
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
      <text x="844" y="184" className="scene-label" fill="#617783" letterSpacing="1.5">
        SERVICE GATES
      </text>
      {Array.from({ length: run.settings.gates }, (_, i) => {
        const { status, truck } = gateAt(run, i, time);
        const y = gateY(i, run.settings.gates);
        const color = status === "BUSY" ? "#009c9a" : status === "RESERVED" ? "#d49b40" : "#22a06b";
        return (
          <g key={i}>
            <path
              d={`M786 ${y}H945`}
              stroke="#dae1e3"
              strokeWidth={run.settings.gates > 6 ? 24 : 43}
            />
            <path
              d={`M788 ${y - 13}h143M788 ${y + 13}h143`}
              stroke="#bac7cc"
              strokeWidth="1"
              strokeDasharray="5 4"
            />
            <rect x="931" y={y - 16} width="9" height="32" rx="2" fill={color} />
            <rect
              x="943"
              y={y - 15}
              width="41"
              height="30"
              rx="3"
              fill="#f9fbfb"
              stroke="#c3d0d4"
            />
            <text
              x="963"
              y={y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#385564"
            >
              G{i + 1}
            </text>
            <circle cx="952" cy={y - 10} r="3" fill={color} />
            {run.settings.gates <= 5 && (
              <text
                x="851"
                y={y + 31}
                textAnchor="middle"
                fontSize="7"
                letterSpacing=".8"
                fill={color}
              >
                {status}
                {truck ? ` · T${truck.id}` : ""}
              </text>
            )}
          </g>
        );
      })}
      {run.trucks.map((t) => {
        const state = stateAt(t, time, run.mode);
        if (state === "NOT ARRIVED" || state === "COMPLETED") return null;
        let [x, y] = bay(t, run.settings.trucks);
        if (state === "ARRIVED") [x, y] = [100, 381 + (t.id % 3) * 10];
        else if (state === "SERVICE") [x, y] = [883, gateY(t.gate, run.settings.gates)];
        else if (run.mode === "traditional") {
          const waiting = run.trucks.filter((v) => v.checkedIn <= time && v.called > time);
          const idx = Math.max(
            0,
            waiting.findIndex((v) => v.id === t.id),
          );
          [x, y] = [681 - Math.floor(idx / 8) * 40, 215 + (idx % 8) * 25];
        }
        if (state === "MOVING") {
          const from: [number, number] =
            run.mode === "smart" ? bay(t, run.settings.trucks) : [681, 350];
          [x, y] = onPath(
            [
              from,
              [from[0], 438],
              [752, 438],
              [752, gateY(t.gate, run.settings.gates)],
              [883, gateY(t.gate, run.settings.gates)],
            ],
            (time - t.moving) / run.settings.travelTime,
          );
        }
        const color =
          state === "SERVICE"
            ? "#537d91"
            : state === "WAIT ENGINE ON" || state === "ARRIVED"
              ? "#d49a52"
              : state === "CALLED FORWARD" || state === "MOVING"
                ? "#3389c0"
                : "#009c9a";
        const small = run.settings.trucks > 50 && state.includes("WAIT");
        return (
          <g
            key={t.id}
            transform={`translate(${x},${y}) scale(${small ? 0.7 : 1})`}
            onClick={() => onSelect(t.id)}
            className="scene-truck"
            tabIndex={0}
            role="button"
            aria-label={`Truck T${t.id}: ${state}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(t.id);
            }}
          >
            <title>
              T{t.id} · {state}
              {t.called <= time ? ` · G${t.gate + 1}` : ""}
            </title>
            {selected === t.id && (
              <rect
                x="-23"
                y="-13"
                width="45"
                height="27"
                rx="6"
                fill="none"
                stroke="#188ab1"
                strokeWidth="2"
                strokeDasharray="3 2"
              />
            )}
            <g filter="url(#truck-shadow)">
              <rect x="-19" y="-7" width="28" height="15" rx="2" fill={color} />
              <rect x="-19" y="-7" width="28" height="15" rx="2" fill="url(#container)" />
              <path d="M11-6h6l4 4v9H11Z" fill="#f9fdfc" stroke={color} strokeWidth="1" />
              <rect x="14" y="-4" width="4" height="5" rx="1" fill="#6c9aa9" />
              <path d="M-14-8h6m-6 17h6M12-8h5m-5 17h5" stroke="#29434d" strokeWidth="2.5" />
            </g>
            <text x="-5" y="3" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="white">
              T{t.id}
            </text>
            {state === "CALLED FORWARD" && (
              <circle cx="17" cy="-13" r="5" fill="#3389c0" className="dispatch-pulse" />
            )}
            {state === "SERVICE" && (
              <g
                aria-label={`${Math.floor(((time - t.atGate) / t.serviceDuration) * 100)}% service complete`}
              >
                <rect x="-20" y="13" width="40" height="3" rx="1.5" fill="#c3d4da" />
                <rect
                  x="-20"
                  y="13"
                  width={40 * Math.min(1, (time - t.atGate) / t.serviceDuration)}
                  height="3"
                  rx="1.5"
                  fill="#009c9a"
                />
              </g>
            )}
          </g>
        );
      })}
      <g transform="translate(37,187)">
        <path d="M0 25V0l-5 9m5-9 5 9" fill="none" stroke="#8ba0ab" strokeWidth="1.5" />
        <text x="-4" y="-8" fontSize="10" fill="#718b97">
          N
        </text>
      </g>
      <g transform="translate(33,487)">
        <path d="M0-5v5h66v-5M33 0v-5" stroke="#91a4ad" strokeWidth="1.5" fill="none" />
        <text x="78" y="3" fontSize="9" fill="#91a4ad">
          SCHEMATIC · NOT TO SCALE
        </text>
      </g>
    </svg>
  );
}
