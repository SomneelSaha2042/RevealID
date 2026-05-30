import { cookies } from "next/headers";
import { AuthNav } from "../../auth/AuthNav";
import { IssuedCredentialList } from "./IssuedCredentialList";
import { IssueCredentialForm } from "./IssueCredentialForm";

type IssuedCredential = {
  id: string;
  holderEmail: string;
  credentialType: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

async function getIssuedCredentials() {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/issuer/credentials`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return { credentials: [] as IssuedCredential[], authenticated: false };
  }

  if (!response.ok) {
    return { credentials: [] as IssuedCredential[], authenticated: false };
  }

  return { ...(await response.json()), authenticated: true } as {
    credentials: IssuedCredential[];
    authenticated: boolean;
  };
}

export default async function IssueCredentialPage() {
  const { credentials, authenticated } = await getIssuedCredentials();

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace">
        <div className="section-heading">
          <p className="eyebrow">Issuer</p>
          <h1>Issue credential</h1>
        </div>
        <IssueCredentialForm />
        <section className="issuer-credentials">
          <div className="section-heading compact-heading">
            <p className="eyebrow">Issuer</p>
            <h2>Issued credentials</h2>
          </div>
          {!authenticated ? (
            <p className="empty-state">Sign in as an issuer to manage issued credentials.</p>
          ) : (
            <IssuedCredentialList credentials={credentials} />
          )}
        </section>
      </section>
    </main>
  );
}
