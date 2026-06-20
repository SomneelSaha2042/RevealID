import { cookies } from "next/headers";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import type { AcademicClaimKey } from "../claim-labels";
import { ShareCredentialForm } from "./ShareCredentialForm";

type CredentialDetail = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  claims: Partial<Record<AcademicClaimKey, string | number>>;
  disclaimer?: string;
  sourceProvenance?: {
    sourceType: string;
    sourceFileHash: string;
    verifiedAt: string;
    verification: {
      all: boolean;
      documentIntegrity: boolean;
      documentStatus: boolean;
      issuerIdentity: boolean;
    };
  };
};

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getCredential(id: string) {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/wallet/credentials/${id}`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { credential: CredentialDetail };
  return body.credential;
}

export default async function CredentialDetailPage({ params }: PageProps) {
  const { id } = await params;
  const credential = await getCredential(id);
  const expired = credential?.expiresAt ? new Date(credential.expiresAt).getTime() <= Date.now() : false;
  const closed = Boolean(credential?.revokedAt) || expired;
  const hasSourceProvenance = Boolean(credential?.sourceProvenance);

  return (
    <AppShell
      description={
        hasSourceProvenance
          ? "Share selected claims from an OpenCerts-derived RevealID credential."
          : "Choose exactly which claims to disclose and generate a holder-bound verification link."
      }
      eyebrow="Holder"
      title={hasSourceProvenance ? "Share OpenCerts-derived credential" : "Share credential"}
    >
        {!credential ? (
          <EmptyState>Credential not found or sign-in expired.</EmptyState>
        ) : (
          <>
            <Card className="credential-card detail-card">
              <div>
                <h2>{credential.sourceProvenance ? "OpenCerts-derived credential" : credential.credentialType}</h2>
                <p>
                  {credential.sourceProvenance
                    ? "Derived by RevealID from an imported OpenCerts source"
                    : credential.issuerName}
                </p>
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
              </div>
            </Card>
            {credential.sourceProvenance ? (
              <section className="provenance-panel" aria-label="Source provenance">
                <div>
                  <span>Source</span>
                  <strong>{credential.sourceProvenance.sourceType}</strong>
                </div>
                <div>
                  <span>Hash</span>
                  <strong>{credential.sourceProvenance.sourceFileHash.slice(0, 19)}...</strong>
                </div>
                <div>
                  <span>Verified</span>
                  <strong>
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                      new Date(credential.sourceProvenance.verifiedAt)
                    )}
                  </strong>
                </div>
                <Badge tone={credential.sourceProvenance.verification.all ? "success" : "warning"}>
                  {credential.sourceProvenance.verification.all ? "Source verified" : "Partial source checks"}
                </Badge>
              </section>
            ) : null}
            {credential.disclaimer ? <p className="privacy-note detail-note">{credential.disclaimer}</p> : null}
            {closed ? (
              <EmptyState>This credential can no longer be shared.</EmptyState>
            ) : (
              <ShareCredentialForm credential={credential} />
            )}
          </>
        )}
    </AppShell>
  );
}
