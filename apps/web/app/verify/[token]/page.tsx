import { AuthNav } from "../../auth/AuthNav";

type VerifyResponse = {
  status: "verified";
  credentialType: string;
  issuerName: string;
  issuedAt: string;
  audience: string;
  expiresAt: string;
  claims: Record<string, string | number>;
};

type PageProps = {
  params: Promise<{ token: string }>;
};

async function verifyShare(token: string) {
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/shares/verify/${token}`, {
      cache: "no-store"
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as VerifyResponse;
}

export default async function VerifySharePage({ params }: PageProps) {
  const { token } = await params;
  const verification = await verifyShare(token);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace narrow-workspace">
        <div className="section-heading">
          <p className="eyebrow">Verifier</p>
          <h1>Credential verification</h1>
        </div>
        {!verification ? (
          <p className="empty-state">This presentation is unavailable, expired, cancelled, or already fully used.</p>
        ) : (
          <section className="verification-panel">
            <div>
              <p className="status verified">Verified holder-bound presentation</p>
              <h2>{verification.credentialType}</h2>
              <p>{verification.issuerName}</p>
            </div>
            <dl>
              {Object.entries(verification.claims).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>
              Issued {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(verification.issuedAt))}.
              Expires{" "}
              {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(verification.expiresAt))}.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
