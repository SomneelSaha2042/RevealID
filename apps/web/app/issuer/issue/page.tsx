import { cookies } from "next/headers";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
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
    <AppShell
      description="Create signed academic credentials and revoke issued credentials when their status changes."
      eyebrow="Issuer"
      title="Issue credential"
    >
      <IssueCredentialForm />
      <section className="issuer-credentials">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Issuer controls</p>
          <h2>Issued credentials</h2>
        </div>
        {!authenticated ? <EmptyState>Sign in as an issuer to manage issued credentials.</EmptyState> : <IssuedCredentialList credentials={credentials} />}
      </section>
    </AppShell>
  );
}
