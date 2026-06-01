import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthNav } from "../app/auth/AuthNav";

export function AppShell({
  children,
  description,
  eyebrow,
  narrow = false,
  title
}: {
  children: ReactNode;
  description?: string;
  eyebrow: string;
  narrow?: boolean;
  title: string;
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="/">
          <ShieldCheck aria-hidden="true" size={20} />
          <span>RevealID</span>
        </a>
        <AuthNav />
      </header>
      <section className={narrow ? "workspace narrow-workspace" : "workspace"}>
        <div className="section-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p className="section-description">{description}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
