import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon } from "lucide-react";
import { fixed } from "./simulation";

export function Button({
  children,
  icon: Icon,
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
  children?: ReactNode;
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {Icon && <Icon size={15} strokeWidth={1.8} />}
      {children}
    </button>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "teal" | "amber" | "blue" | "gray" | "red";
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Kpi({
  title,
  value,
  unit,
  icon: Icon,
  detail,
  accent = "teal",
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span>{title}</span>
        <div className={`kpi-icon ${accent}`}>
          <Icon size={17} strokeWidth={1.7} />
        </div>
      </div>
      <div className="kpi-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="kpi-detail">{detail}</div>
    </div>
  );
}
export function Delta({
  before,
  after,
  inverse = false,
}: {
  before: number;
  after: number;
  inverse?: boolean;
}) {
  if (Math.abs(after - before) < 0.00001) return <span className="neutral">No change</span>;
  const change = before ? ((after - before) / before) * 100 : 0;
  const good = inverse ? after > before : after < before;
  return (
    <span className={`delta ${good ? "good" : "bad"}`}>
      {after < before ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
      {before ? `${fixed(Math.abs(change))}%` : "From zero"}
    </span>
  );
}
export function Disclaimer() {
  return (
    <div className="disclaimer">
      <Info size={13} />
      <span>SIMULATED ASSUMPTIONS, NOT MEASURED PORT DATA</span>
      <span className="disclaimer-extra">Deterministic model · Educational & research use</span>
    </div>
  );
}
