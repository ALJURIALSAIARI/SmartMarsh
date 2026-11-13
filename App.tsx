import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Download,
  FileChartColumn,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Disclaimer } from "./components";
import { downloadProjectArchive } from "./projectDownload";
import smartMarshLogo from "./smartmarsh-logo.jpg";
import {
  DEFAULTS,
  simulate,
  validSettings,
  type DriverAcknowledgment,
  type Mode,
  type Settings,
} from "./simulation";
import SimulationView from "./SimulationView";
const Analytics = lazy(() => import("./Analytics"));
const TruckData = lazy(() => import("./TruckData"));
const SettingsPage = lazy(() => import("./SettingsPage"));
const About = lazy(() => import("./Information").then((module) => ({ default: module.About })));
const Results = lazy(() => import("./Information").then((module) => ({ default: module.Results })));

// Embed text in the app's JavaScript, avoiding ZIP requests that preview hosts can reject.
// The standalone export omits this payload and its download control.
const projectArchiveBase64 = Object.values(
  import.meta.glob<string>("../exports/SmartMarsh-GitHub.base64.ts", {
    eager: true,
    import: "default",
  }),
)[0];

const pages = [
  {
    id: "simulation",
    label: "Simulation",
    icon: LayoutDashboard,
    title: "Simulation workspace",
    subtitle: "A smarter flow for every truck. Simulate, observe, and compare.",
  },
  {
    id: "analytics",
    label: "Analytics Dashboard",
    icon: BarChart3,
    title: "Analytics dashboard",
    subtitle: "From terminal events to engineering insights. Every number is traceable.",
  },
  {
    id: "trucks",
    label: "Truck Data Table",
    icon: ClipboardList,
    title: "Truck data register",
    subtitle: "Follow every truck, timestamp, and gate assignment through the terminal.",
  },
  {
    id: "results",
    label: "Results & Conclusions",
    icon: FileChartColumn,
    title: "Results & conclusions",
    subtitle: "An honest assessment of environmental benefits and operational trade-offs.",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    title: "Simulation settings",
    subtitle: "Design your experiment with consistent, transparent operating assumptions.",
  },
  {
    id: "about",
    label: "About the Project",
    icon: CircleHelp,
    title: "About the project",
    subtitle: "An industrial engineering approach to more sustainable port operations.",
  },
] as const;
type Page = (typeof pages)[number]["id"];
function initialPage(): Page {
  const hash = window.location.hash.slice(1);
  return pages.some((p) => p.id === hash) ? (hash as Page) : "simulation";
}
function initialSettings() {
  try {
    return validSettings(JSON.parse(localStorage.getItem("smartmarsh-settings-v1") ?? "null"));
  } catch {
    return { ...DEFAULTS };
  }
}
export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [mode, setMode] = useState<Mode>("smart");
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [acknowledgments, setAcknowledgments] = useState<DriverAcknowledgment[]>([]);
  const smart = useMemo(() => simulate(settings, "smart"), [settings]);
  const traditional = useMemo(() => simulate(settings, "traditional"), [settings]);
  const run = mode === "smart" ? smart : traditional;
  const current = pages.find((p) => p.id === page)!;
  useEffect(() => {
    try {
      localStorage.setItem("smartmarsh-settings-v1", JSON.stringify(settings));
    } catch {
      setToast("Browser storage is unavailable. Settings will last for this session only.");
    }
  }, [settings]);
  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = ((now - previous) / 1000) * settings.speed;
      previous = now;
      setTime((t) => Math.min(run.duration, t + delta));
    }, 40);
    return () => clearInterval(timer);
  }, [running, run.duration, settings.speed]);
  useEffect(() => {
    if (running && time >= run.duration) setRunning(false);
  }, [time, run.duration, running]);
  useEffect(() => {
    const handler = () => {
      setPage(initialPage());
      setMobileOpen(false);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    document.title = `${current.label} · SmartMarsh`;
  }, [current.label]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function navigate(next: Page) {
    setPage(next);
    window.location.hash = next;
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function reset() {
    setRunning(false);
    setTime(0);
    setStarted(false);
    setAcknowledgments([]);
  }
  function acknowledge(truckId: number) {
    const truck = run.trucks.find((t) => t.id === truckId);
    if (!truck || time < truck.called || time >= truck.serviceEnd) return;
    setAcknowledgments((records) =>
      records.some((a) => a.mode === mode && a.truck === truckId)
        ? records
        : [...records, { mode, truck: truckId, gate: truck.gate, time }],
    );
  }
  function paired() {
    setRunning(false);
    setStarted(true);
    setTime(Math.max(smart.duration, traditional.duration));
    navigate(page === "results" ? "results" : "analytics");
    setToast(`Paired experiment complete · ${settings.trucks * 2} truck journeys simulated`);
  }
  function saveProject() {
    if (!projectArchiveBase64) return;
    try {
      downloadProjectArchive(projectArchiveBase64);
      setToast("بدأ تنزيل SmartMarsh-GitHub.zip — تحققي من قائمة التنزيلات في المتصفح.");
    } catch {
      setToast("تعذّر تجهيز الملف. حدّثي معاينة التطبيق ثم حاولي مرة أخرى.");
    }
  }
  const pairProps = { smart, traditional, time, onCompare: paired };
  return (
    <div className="app-shell">
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <a
          href="#simulation"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("simulation");
          }}
          aria-label="SmartMarsh home"
        >
          <img
            className="brand-symbol"
            src={smartMarshLogo}
            alt="SmartMarsh logo"
            width={40}
            height={40}
          />
          <div>
            <strong>
              Smart<span>Marsh</span>
            </strong>
            <small>PORT FLOW. REIMAGINED.</small>
          </div>
        </a>
        <div className="sidebar-workspace">
          <span className="workspace-icon">
            <Activity size={16} />
          </span>
          <div>
            <strong>Port Operations Lab</strong>
            <small>Simulation workspace</small>
          </div>
          <span className="workspace-status" />
        </div>
        <div className="navigation-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {pages.slice(0, 4).map((p) => (
            <button
              key={p.id}
              aria-current={page === p.id ? "page" : undefined}
              className={page === p.id ? "active" : ""}
              onClick={() => navigate(p.id)}
            >
              <p.icon size={18} strokeWidth={1.6} />
              <span>{p.label}</span>
              {page === p.id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className="navigation-label tools-label">CONFIGURATION</div>
        <nav aria-label="Configuration navigation">
          {pages.slice(4).map((p) => (
            <button
              key={p.id}
              aria-current={page === p.id ? "page" : undefined}
              className={page === p.id ? "active" : ""}
              onClick={() => navigate(p.id)}
            >
              <p.icon size={18} strokeWidth={1.6} />
              <span>{p.label}</span>
              {page === p.id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-card">
            <GraduationCap size={23} strokeWidth={1.4} />
            <span>ENGINEERED FOR INSIGHT</span>
            <h3>
              Better decisions.
              <br />
              Lower idle emissions.
            </h3>
            <p>An industrial engineering simulation project.</p>
            <button onClick={() => navigate("about")}>
              Explore the methodology <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="sidebar-footer">
            <span>
              <i />
              Local simulation engine
            </span>
            <small>SmartMarsh v1.0</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className={`app-header${projectArchiveBase64 ? " has-project-download" : ""}`}>
          <div className="header-breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <ChevronRight size={13} />
            <strong>{current.label}</strong>
          </div>
          <div className="header-right">
            <span className="header-engine">
              <i />
              Discrete-event engine
            </span>
            <span className="header-divider" />
            {projectArchiveBase64 && (
              <button
                type="button"
                onClick={saveProject}
                className="btn btn-primary project-download"
                dir="rtl"
              >
                <Download size={15} aria-hidden="true" />
                <span>تحميل المشروع ZIP</span>
              </button>
            )}
            <button onClick={() => navigate("about")} className="guide-button">
              <BookOpen size={15} />
              Model guide
            </button>
            <div className="profile-mark" title="Industrial engineering workspace">
              IE
            </div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="heading-line" />
                PORT OPERATIONS INTELLIGENCE
              </div>
              <h1>{current.title}</h1>
              <p>{current.subtitle}</p>
            </div>
            <div className="project-badge">
              <GraduationCap size={15} />
              <span>Industrial Engineering Project</span>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="page-loading" role="status">
                <Activity size={20} />
                Loading workspace…
              </div>
            }
          >
            {page === "simulation" && (
              <SimulationView
                run={run}
                traditional={traditional}
                time={Math.min(time, run.duration)}
                running={running}
                started={started}
                mode={mode}
                acknowledgments={acknowledgments}
                onAcknowledge={acknowledge}
                notify={setToast}
                onMode={setMode}
                onStart={() => {
                  if (time >= run.duration) {
                    setTime(0);
                    setAcknowledgments([]);
                  }
                  setRunning(true);
                  setStarted(true);
                }}
                onPause={() => setRunning(false)}
                onReset={reset}
                onCompare={paired}
                onSpeed={(speed) => setSettings((s) => ({ ...s, speed }))}
                onSettings={() => navigate("settings")}
                onSeek={(t) => {
                  setRunning(false);
                  setStarted(true);
                  // Range controls round their serialized maximum; snap back to the exact final event.
                  setTime(Math.abs(run.duration - t) < 1e-8 ? run.duration : t);
                  setAcknowledgments((records) => records.filter((a) => a.time <= t));
                }}
              />
            )}
            {page === "analytics" && <Analytics {...pairProps} />}
            {page === "trucks" && <TruckData {...pairProps} notify={setToast} />}
            {page === "results" && <Results {...pairProps} />}
            {page === "settings" && (
              <SettingsPage
                settings={settings}
                onApply={(next) => {
                  setSettings(next);
                  reset();
                  setToast("Settings saved and applied · both simulation timelines reset");
                }}
              />
            )}
            {page === "about" && <About onSimulation={() => navigate("simulation")} />}
          </Suspense>
          <Disclaimer />
          <footer className="page-footer">
            <span>
              SmartMarsh <span> / </span> Port Truck Marshalling Simulation
            </span>
            <span>
              <ShieldCheck size={12} />
              Transparent assumptions. Reproducible outcomes.
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
