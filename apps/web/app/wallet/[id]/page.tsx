import { cookies } from "next/headers";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { ShareCredentialForm } from "./ShareCredentialForm";

type CredentialDetail = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  claims: {
    degree: string;
    graduationYear: number;
    cgpa: number;
    marks: number;
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

  return (
    <AppShell
      description="Choose exactly which claims to disclose and generate a holder-bound verification link."
      eyebrow="Holder"
      title="Share credential"
    >
        {!credential ? (
          <EmptyState>Credential not found or sign-in expired.</EmptyState>
        ) : (
          <>
            <Card className="credential-card detail-card">
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
              </div>
            </Card>
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
