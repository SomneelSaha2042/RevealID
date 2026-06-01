import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthNav } from "./auth/AuthNav";
import { ButtonLink } from "../components/ui/button";
import { Card } from "../components/ui/card";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

async function getHealth() {
  try {
    const response = await fetch(`${apiBase}/health`, { cache: "no-store" });
    return response.ok ? "API reachable" : "API unavailable";
  } catch {
    return "API unavailable";
  }
}

export default async function Home() {
  const health = await getHealth();

  return (
    <main className="shell">
      <header className="topbar home-topbar">
        <a className="brand-lockup" href="/">
          <ShieldCheck aria-hidden="true" size={20} />
          <span>RevealID</span>
        </a>
        <AuthNav />
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Selective disclosure credential wallet</p>
          <h1>Verify academic credentials without oversharing private data.</h1>
          <p className="lede">
            RevealID issues holder-bound SD-JWT credentials, lets holders disclose only selected claims, and gives
            verifiers a cryptographic report without exposing hidden CGPA or marks.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/login">
              Sign in <ArrowRight aria-hidden="true" size={16} />
            </ButtonLink>
            <ButtonLink href="/issuer/issue" variant="secondary">
              Issue credential
            </ButtonLink>
          </div>
          <div className="status">
            <span aria-hidden="true" />
            {health}
          </div>
        </div>
        <Card className="hero-panel">
          <div className="hero-panel-header">
            <ShieldCheck aria-hidden="true" size={24} />
            <div>
              <strong>Verifier result</strong>
              <p>Disclosed claims only</p>
            </div>
          </div>
          <dl className="claim-preview">
            <div>
              <dt>degree</dt>
              <dd>BSc Computer Science</dd>
            </div>
            <div>
              <dt>graduationYear</dt>
              <dd>2026</dd>
            </div>
          </dl>
          <ul className="trust-list">
            <li>
              <CheckCircle2 aria-hidden="true" size={16} />
              Issuer signature verified
            </li>
            <li>
              <KeyRound aria-hidden="true" size={16} />
              Holder key binding verified
            </li>
            <li>
              <LockKeyhole aria-hidden="true" size={16} />
              CGPA and marks withheld
            </li>
          </ul>
        </Card>
      </section>
      <section className="feature-strip">
        <Card>
          <strong>SD-JWT disclosure</strong>
          <p>Selected claims verify against signed disclosure digests.</p>
        </Card>
        <Card>
          <strong>Encrypted custody</strong>
          <p>Credentials, presentations, and holder private keys stay encrypted at rest.</p>
        </Card>
        <Card>
          <strong>Public verifier</strong>
          <p>Share links and QR codes open a no-login verification report.</p>
        </Card>
      </section>
      <section className="demo-callout">
        <strong>Demo path</strong>
        <span>Issuer issues to holder@example.edu, holder shares degree and year, verifier sees only those fields.</span>
      </section>
      <section className="mobile-actions">
        <div className="actions">
          <ButtonLink href="/register" variant="ghost">Register holder</ButtonLink>
          <ButtonLink href="/wallet" variant="ghost">Open wallet</ButtonLink>
        </div>
      </section>
    </main>
  );
}
