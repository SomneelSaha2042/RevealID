import { cookies } from "next/headers";
import { Upload } from "lucide-react";
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

  return (
    <AppShell
      description="Manage credentials you own and create selective disclosure links from active credentials."
      eyebrow="Holder"
      title="Wallet"
    >
        {authenticated ? (
          <div className="wallet-actions">
            <ButtonLink href="/wallet/import" variant="secondary">
              <Upload aria-hidden="true" size={16} />
              Import OpenCerts
            </ButtonLink>
          </div>
        ) : null}
        {!authenticated ? <EmptyState>Sign in as a holder to view wallet credentials.</EmptyState> : null}
        {authenticated && credentials.length === 0 ? <EmptyState>No credentials in this wallet.</EmptyState> : null}
        {credentials.length > 0 ? (
          <div className="credential-list">
            {credentials.map((credential) => {
              const expired = credential.expiresAt ? new Date(credential.expiresAt).getTime() <= Date.now() : false;
              const closed = Boolean(credential.revokedAt) || expired;
              return (
                <Card className="credential-card" key={credential.id}>
                  <div>
                    <h2>{credential.credentialType}</h2>
                    <p>{credential.issuerName}</p>
                    {credential.expiresAt ? (
                      <p>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.expiresAt))}</p>
                    ) : null}
                  </div>
                  <div className="card-actions">
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
