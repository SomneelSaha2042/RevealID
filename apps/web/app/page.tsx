import { ArrowRight, FileJson, KeyRound, LockKeyhole, ShieldCheck, Upload } from "lucide-react";
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
          <p className="eyebrow">OpenCerts bridge and selective disclosure wallet</p>
          <h1>Turn an OpenCerts file into a private sharing credential.</h1>
          <p className="lede">
            RevealID verifies a holder-provided OpenCerts source, derives a wallet credential, and lets the holder
            share only selected academic claims with a verifier.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/wallet/import">
              <Upload aria-hidden="true" size={16} />
              Import OpenCerts
            </ButtonLink>
            <ButtonLink href="/wallet" variant="secondary">
              Open wallet <ArrowRight aria-hidden="true" size={16} />
            </ButtonLink>
          </div>
          <div className="status">
            <span aria-hidden="true" />
            {health}
          </div>
        </div>
        <Card className="hero-panel bridge-panel">
          <div className="hero-panel-header">
            <FileJson aria-hidden="true" size={24} />
            <div>
              <strong>Bridge workflow</strong>
              <p>Source file to selective share</p>
            </div>
          </div>
          <ol className="bridge-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Verify OpenCerts</strong>
                <p>Check source integrity before normalization.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Derive RevealID credential</strong>
                <p>Store a holder-bound SD-JWT credential with provenance.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Share selected claims</strong>
                <p>Verifier sees disclosed fields only.</p>
              </div>
            </li>
          </ol>
        </Card>
      </section>
      <section className="feature-strip">
        <Card>
          <ShieldCheck aria-hidden="true" size={18} />
          <strong>OpenCerts source first</strong>
          <p>Import starts from a JSON OpenCerts file and records source hash, checks, and provenance.</p>
        </Card>
        <Card>
          <KeyRound aria-hidden="true" size={18} />
          <strong>RevealID credentials too</strong>
          <p>Native issuer-created credentials still live in the same encrypted wallet and share flow.</p>
        </Card>
        <Card>
          <LockKeyhole aria-hidden="true" size={18} />
          <strong>Privacy by default</strong>
          <p>Hidden source fields, grades, transcript rows, and IDs stay out of verifier responses.</p>
        </Card>
      </section>
      <section className="demo-callout">
        <strong>Demo path</strong>
        <span>Upload the public OpenCerts sample, derive a wallet credential, then share recipient, institution, course, or graduation date.</span>
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
