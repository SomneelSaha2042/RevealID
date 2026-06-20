import { cookies } from "next/headers";
import { FileJson, ShieldCheck, Upload, WalletCards } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { Badge } from "../../components/ui/badge";
import { ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/empty-state";

type WalletCredential = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

const isOpenCertsDerived = (credential: WalletCredential) =>
  credential.credentialType === "RevealIDDerivedAcademicCredential" ||
  credential.credentialType.toLowerCase().includes("derivedacademic");

async function getCredentials() {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/wallet/credentials`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return { credentials: [] as WalletCredential[], authenticated: false };
  }

  if (!response.ok) {
    return { credentials: [] as WalletCredential[], authenticated: false };
  }

  return { ...(await response.json()), authenticated: true } as {
    credentials: WalletCredential[];
    authenticated: boolean;
  };
}

export default async function WalletPage() {
  const { credentials, authenticated } = await getCredentials();
  const openCertsCredentials = credentials.filter(isOpenCertsDerived);
  const revealIdCredentials = credentials.filter((credential) => !isOpenCertsDerived(credential));

  return (
    <AppShell
      description="Start with an OpenCerts import, then manage derived and native RevealID credentials from one wallet."
      eyebrow="Holder"
      title="Credential workspace"
    >
        {authenticated ? (
          <section className="workspace-actions" aria-label="Credential workspace actions">
            <div className="primary-workflow">
              <div>
                <p className="eyebrow">Primary workflow</p>
                <h2>Import an OpenCerts source</h2>
                <p>Verify a source file, derive a RevealID credential, then share selected claims.</p>
              </div>
              <ButtonLink href="/wallet/import">
                <Upload aria-hidden="true" size={16} />
                Import OpenCerts
              </ButtonLink>
            </div>
            <div className="source-summary">
              <div>
                <FileJson aria-hidden="true" size={18} />
                <span>OpenCerts-derived</span>
                <strong>{openCertsCredentials.length}</strong>
              </div>
              <div>
                <WalletCards aria-hidden="true" size={18} />
                <span>RevealID native</span>
                <strong>{revealIdCredentials.length}</strong>
              </div>
            </div>
          </section>
        ) : null}
        {!authenticated ? <EmptyState>Sign in as a holder to view wallet credentials.</EmptyState> : null}
        {authenticated && credentials.length === 0 ? <EmptyState>No credentials in this wallet.</EmptyState> : null}
        {credentials.length > 0 ? (
          <div className="credential-list">
            {credentials.map((credential) => {
              const expired = credential.expiresAt ? new Date(credential.expiresAt).getTime() <= Date.now() : false;
              const closed = Boolean(credential.revokedAt) || expired;
              const derived = isOpenCertsDerived(credential);
              return (
                <Card className="credential-card" key={credential.id}>
                  <div>
                    <div className="credential-title-row">
                      {derived ? <FileJson aria-hidden="true" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
                      <h2>{derived ? "OpenCerts-derived credential" : credential.credentialType}</h2>
                    </div>
                    <p>{derived ? "Derived by RevealID from an imported source" : credential.issuerName}</p>
                    {credential.expiresAt ? (
                      <p>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.expiresAt))}</p>
                    ) : null}
                  </div>
                  <div className="card-actions">
                    <Badge tone={derived ? "warning" : "neutral"}>{derived ? "OpenCerts bridge" : "RevealID"}</Badge>
                    <Badge tone={closed ? "neutral" : "success"}>
                      {credential.revokedAt ? "Revoked" : expired ? "Expired" : "Active"}
                    </Badge>
                    <time dateTime={credential.issuedAt}>
                      {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.issuedAt))}
                    </time>
                    {closed ? (
                      <span className="inline-action disabled-action">Share unavailable</span>
                    ) : (
                      <ButtonLink href={`/wallet/${credential.id}`} variant="secondary">
                        Share
                      </ButtonLink>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
    </AppShell>
  );
}
