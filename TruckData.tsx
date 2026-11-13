import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
  X,
  Truck as TruckIcon,
  ListFilter,
} from "lucide-react";
import { Badge, Button, Panel } from "./components";
import { downloadCsv } from "./csv";
import { clock, fixed, idleMinutes, stateAt, type Mode, type Run, type Truck } from "./simulation";

export default function TruckData({
  smart,
  traditional,
  time,
  notify,
}: {
  smart: Run;
  traditional: Run;
  time: number;
  notify: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("smart");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: "id", asc: true });
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Truck | null>(null);
  const run = mode === "smart" ? smart : traditional;
  const now = Math.min(time, run.duration);
  const get = (t: Truck, key: string): number | string | null => {
    if (key === "state") return stateAt(t, now, mode);
    if (key === "idle") return idleMinutes(t, mode, now);
    if (key === "turnaround") return t.serviceEnd <= now ? t.serviceEnd - t.arrival : null;
    if (key === "gate") return t.called <= now ? t.gate : null;
    if (key === "id") return t.id;
    const timestamp = t[key as keyof Truck];
    return timestamp <= now ? timestamp : null;
  };
  const filtered = useMemo(
    () =>
      run.trucks
        .filter((t) => {
          const state = stateAt(t, now, mode);
          const q = search.toLowerCase().trim();
          const matches =
            !q ||
            `t${t.id} truck ${t.id} ${state} ${t.called <= now ? `g${t.gate + 1} gate ${t.gate + 1}` : ""}`
              .toLowerCase()
              .includes(q);
          return (
            matches &&
            (filter === "all" ||
              (filter === "active"
                ? !["NOT ARRIVED", "COMPLETED"].includes(state)
                : state === filter))
          );
        })
        .sort((a, b) => {
          const av = get(a, sort.key),
            bv = get(b, sort.key);
          // Unknown future events stay last in both directions and never leak the future schedule.
          if (av === null && bv === null) return a.id - b.id;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (
            (typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv)) *
              (sort.asc ? 1 : -1) || a.id - b.id
          );
        }),
    [run, now, mode, search, filter, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  function changeSort(key: string) {
    setSort({ key, asc: sort.key === key ? !sort.asc : true });
    setPage(0);
  }
  function exportRow(t: Truck) {
    return {
      truck: `T${t.id}`,
      mode: mode === "smart" ? "SmartMarsh" : "Traditional",
      state: stateAt(t, now, mode),
      gate: t.called <= now ? `G${t.gate + 1}` : "",
      arrival_min: t.arrival <= now ? t.arrival : "",
      checked_in_min: t.checkedIn <= now ? t.checkedIn : "",
      called_forward_min: t.called <= now ? t.called : "",
      moving_min: t.moving <= now ? t.moving : "",
      at_gate_service_start_min: t.atGate <= now ? t.atGate : "",
      service_end_min: t.serviceEnd <= now ? t.serviceEnd : "",
      waiting_min: t.called <= now ? t.called - t.checkedIn : "",
      turnaround_min: t.serviceEnd <= now ? t.serviceEnd - t.arrival : "",
      stationary_engine_on_idle_min: idleMinutes(t, mode, now),
      idle_fuel_L: (idleMinutes(t, mode, now) / 60) * run.settings.idleRate,
      idle_CO2_kg:
        (idleMinutes(t, mode, now) / 60) * run.settings.idleRate * run.settings.co2Factor,
      seed: run.settings.seed,
      snapshot_min: now,
    };
  }
  async function download(format: "csv" | "xlsx") {
    try {
      const rows = filtered.map(exportRow);
      const headers = Object.keys(exportRow(run.trucks[0]));
      const filename = `SmartMarsh-${mode}-seed${run.settings.seed}`;
      if (format === "csv") {
        downloadCsv(
          `${filename}.csv`,
          headers,
          rows.map((row) => headers.map((h) => row[h as keyof typeof row])),
        );
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(rows, { header: headers }),
          "Truck data",
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            run.events
              .filter((e) => e.time <= now && filtered.some((t) => t.id === e.truck))
              .map((e) => ({
                time_min: e.time,
                timestamp: clock(e.time),
                truck: `T${e.truck}`,
                gate: e.gate === undefined ? "" : `G${e.gate + 1}`,
                state: e.state,
                event: e.message,
              })),
            { header: ["time_min", "timestamp", "truck", "gate", "state", "event"] },
          ),
          "Event log",
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet([
            ...Object.entries(run.settings).map(([parameter, value]) => ({
              parameter,
              value: String(value),
            })),
            { parameter: "disclaimer", value: "SIMULATED ASSUMPTIONS, NOT MEASURED PORT DATA" },
            {
              parameter: "time_units",
              value: "Minutes from simulation origin; future timestamps withheld",
            },
            {
              parameter: "smart_reaction",
              value: "0.1 min; engine off during notification reaction",
            },
            { parameter: "service", value: "Engine off in both modes; travel fuel not modeled" },
          ]),
          "Assumptions",
        );
        XLSX.writeFile(wb, `${filename}.xlsx`);
      }
      notify(`${format.toUpperCase()} exported · ${rows.length} truck records`);
    } catch {
      notify("Export could not be created. Please try again.");
    }
  }
  const columns = [
    { key: "id", label: "TRUCK" },
    { key: "state", label: "CURRENT STATE" },
    { key: "gate", label: "GATE" },
    { key: "arrival", label: "ARRIVAL" },
    { key: "checkedIn", label: "CHECKED IN" },
    { key: "called", label: "DISPATCH" },
    { key: "serviceEnd", label: "COMPLETED" },
    { key: "idle", label: "IDLE (MIN)" },
    { key: "turnaround", label: "TURNAROUND" },
  ];
  return (
    <>
      <div className="data-intro">
        <div>
          <Badge tone="blue">EVENT-SOURCED DATA</Badge>
          <p>
            Inspect every truck’s journey. Future timestamps are hidden until their events occur.
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={ArrowDownToLine} onClick={() => download("csv")}>
            Export CSV
          </Button>
          <Button icon={FileSpreadsheet} variant="primary" onClick={() => download("xlsx")}>
            Export XLSX
          </Button>
        </div>
      </div>
      <Panel
        title="Truck movement register"
        subtitle={`Seed ${run.settings.seed} · Snapshot ${clock(now)} · ${run.settings.trucks} trucks in this experiment`}
      >
        <div className="data-filters">
          <div className="mode-toggle compact">
            <button
              className={mode === "smart" ? "active" : ""}
              onClick={() => {
                setMode("smart");
                setPage(0);
              }}
            >
              SmartMarsh
            </button>
            <button
              className={mode === "traditional" ? "active" : ""}
              onClick={() => {
                setMode("traditional");
                setPage(0);
              }}
            >
              Traditional
            </button>
          </div>
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search trucks"
              placeholder="Search truck, gate, or state…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
          <label className="state-filter">
            <ListFilter size={15} />
            <select
              aria-label="Filter trucks by state"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All states</option>
              <option value="active">Active trucks</option>
              {[
                "NOT ARRIVED",
                "ARRIVED",
                "WAIT ENGINE OFF",
                "WAIT ENGINE ON",
                "CALLED FORWARD",
                "MOVING",
                "SERVICE",
                "COMPLETED",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table className="truck-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    aria-sort={
                      sort.key === c.key ? (sort.asc ? "ascending" : "descending") : "none"
                    }
                  >
                    <button onClick={() => changeSort(c.key)}>
                      {c.label}
                      <ArrowUpDown size={11} className={sort.key === c.key ? "teal-text" : ""} />
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(currentPage * 10, currentPage * 10 + 10).map((t) => {
                const state = stateAt(t, now, mode);
                return (
                  <tr key={t.id}>
                    <td>
                      <span className="truck-id">
                        <TruckIcon size={15} />T{t.id}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          state === "COMPLETED"
                            ? "green"
                            : state === "WAIT ENGINE ON"
                              ? "amber"
                              : state === "NOT ARRIVED"
                                ? "gray"
                                : "teal"
                        }
                      >
                        {state}
                      </Badge>
                    </td>
                    <td>{t.called <= now ? `G${t.gate + 1}` : "—"}</td>
                    <td className="mono">{t.arrival <= now ? clock(t.arrival) : "—"}</td>
                    <td className="mono">{t.checkedIn <= now ? clock(t.checkedIn) : "—"}</td>
                    <td className="mono">{t.called <= now ? clock(t.called) : "—"}</td>
                    <td className="mono">{t.serviceEnd <= now ? clock(t.serviceEnd) : "—"}</td>
                    <td>{fixed(idleMinutes(t, mode, now), 2)}</td>
                    <td>{t.serviceEnd <= now ? `${fixed(t.serviceEnd - t.arrival)} min` : "—"}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View truck T${t.id} events`}
                        onClick={() => setDetail(t)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={26} />
              <strong>No trucks found</strong>
              <span>Try another search term or state filter.</span>
              <Button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length
              ? `${currentPage * 10 + 1}–${Math.min((currentPage + 1) * 10, filtered.length)}`
              : "0"}{" "}
            of {filtered.length} trucks <small>· Exports include all filtered rows</small>
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              aria-label="Next page"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </Panel>
      <div className="data-equations">
        <h3>Reading the register</h3>
        <p>
          <b>Arrival → check-in:</b> stationary, engine on in both modes. <b>Waiting:</b> check-in
          complete to call-forward. <b>Turnaround:</b> completion minus arrival. Gate reservations
          are disclosed at dispatch. Values marked “—” have not occurred at this snapshot.
        </p>
        <p>
          CSV and XLSX exports retain full numerical precision in minutes. The workbook also
          includes the actual event log and model assumptions.
        </p>
      </div>
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Truck T${detail.id} event timeline`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDetail(null);
            }}
          >
            <div className="panel-heading">
              <div>
                <h2>Truck T{detail.id} · event timeline</h2>
                <p>
                  {mode === "smart" ? "SmartMarsh" : "Traditional"} · as of {clock(now)}
                </p>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close truck details"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="detail-events">
              {run.events
                .filter((e) => e.truck === detail.id && e.time <= now)
                .map((e) => (
                  <div key={e.seq}>
                    <span className="mono">{clock(e.time)}</span>
                    <div>
                      <strong>{e.state}</strong>
                      <p>{e.message}</p>
                    </div>
                  </div>
                ))}
              {detail.arrival > now && (
                <p className="empty-state">This truck has not yet arrived.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
