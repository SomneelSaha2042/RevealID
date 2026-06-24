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
    <main className="min-h-screen bg-background text-on-background font-body-md overflow-x-hidden selection:bg-primary selection:text-on-primary-container">
      {/* TopNavBar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-container-max mx-auto px-grid-margin flex items-center justify-between min-h-16 py-2 md:py-0 h-auto md:h-16 flex-wrap md:flex-nowrap gap-4">
          <div className="flex items-center gap-8 shrink-0">
            <a className="brand-lockup font-headline-md text-headline-md font-bold text-primary flex items-center gap-2" href="/">
              <ShieldCheck aria-hidden="true" size={20} />
              <span>RevealID</span>
            </a>
          </div>
          <AuthNav />
        </div>
      </header>

      {/* Workspace */}
      <section className="pt-24 pb-stack-lg max-w-container-max mx-auto px-grid-margin">
        <div className={narrow ? "max-w-2xl mx-auto space-y-8" : "space-y-8"}>
          <div className="mb-12">
            <p className="font-label-md text-primary text-xs uppercase tracking-widest mb-2">{eyebrow}</p>
            <h1 className="font-display-xl text-[40px] md:text-[52px] mb-4 text-white font-bold leading-tight tracking-tight">{title}</h1>
            {description ? <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">{description}</p> : null}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
