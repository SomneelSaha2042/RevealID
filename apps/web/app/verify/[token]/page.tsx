import { AppShell } from "../../../components/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { formatClaimValue, labelForClaim } from "../../wallet/claim-labels";

type VerificationCheck = {
  id: string;
  label: string;
  status: "passed" | "failed" | "skipped";
};

type VerifyResponse =
  | {
      status: "verified";
      credentialType: string;
      issuerName: string;
      issuedAt: string;
      audience: string;
      expiresAt: string;
      claims: Record<string, string | number>;
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
      checks: VerificationCheck[];
    }
  | {
      status: "invalid";
      failureCode: "unknown" | "malformed" | "expired" | "cancelled" | "exhausted" | "revoked" | "tampered";
      message: string;
      checks: VerificationCheck[];
    };

type PageProps = {
  params: Promise<{ token: string }>;
};

const failureCopy: Record<
  Extract<VerifyResponse, { status: "invalid" }>["failureCode"] | "network",
  { title: string; detail: string }
> = {
  expired: {
    title: "Expired Link",
    detail: "This verification link is past its allowed viewing window."
  },
  cancelled: {
    title: "Cancelled Share",
    detail: "The holder cancelled this share before it could be verified."
  },
  revoked: {
    title: "Revoked Credential",
    detail: "The issuer has revoked this credential, so it cannot be accepted."
  },
  tampered: {
    title: "Tampered Presentation",
    detail: "The presentation failed one or more cryptographic verification checks."
  },
  exhausted: {
    title: "Verification Limit Reached",
    detail: "This share link has already been viewed the maximum number of times."
  },
  malformed: {
    title: "Malformed Token",
    detail: "This verification token is not in a format RevealID can verify."
  },
  unknown: {
    title: "Unknown Token",
    detail: "No active share matches this verification token."
  },
  network: {
    title: "Verification Unavailable",
    detail: "RevealID could not reach the verifier service."
  }
};

async function verifyShare(token: string): Promise<VerifyResponse | null> {
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/credentials/verify`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as VerifyResponse;
}

function CheckList({ checks }: { checks: VerificationCheck[] }) {
  return (
    <ul className="verification-checks">
      {checks.map((check) => (
        <li key={check.id} className={check.status}>
          <span aria-hidden="true" />
          <strong>{check.label}</strong>
          <small>{check.status}</small>
        </li>
      ))}
    </ul>
  );
}

export default async function VerifySharePage({ params }: PageProps) {
  const { token } = await params;
  const verification = await verifyShare(token);
  const failure = verification?.status === "invalid" ? failureCopy[verification.failureCode] : failureCopy.network;

  return (
    <AppShell
      description="Public verification report for a holder-generated selective disclosure presentation."
      eyebrow="Verifier"
      narrow
      title="Credential verification"
    >
        {verification?.status === "verified" ? (
          <Card className="verification-panel">
            <div>
              <Badge tone="success">Cryptographically Verified</Badge>
              <h2>
                {verification.sourceProvenance ? "OpenCerts-derived RevealID presentation" : verification.credentialType}
              </h2>
              <p>
                {verification.sourceProvenance
                  ? "Holder-selected claims from a RevealID-derived credential"
                  : verification.issuerName}
              </p>
            </div>
            <dl>
              {Object.entries(verification.claims).map(([key, value]) => (
                <div key={key}>
                  <dt>{labelForClaim(key)}</dt>
                  <dd>{formatClaimValue(key, value)}</dd>
                </div>
              ))}
            </dl>
            {verification.sourceProvenance ? (
              <section className="provenance-panel compact" aria-label="Source provenance">
                <div>
                  <span>Source</span>
                  <strong>{verification.sourceProvenance.sourceType}</strong>
                </div>
                <div>
                  <span>Hash</span>
                  <strong>{verification.sourceProvenance.sourceFileHash.slice(0, 19)}...</strong>
                </div>
                <div>
                  <span>Verified</span>
                  <strong>
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                      new Date(verification.sourceProvenance.verifiedAt)
                    )}
                  </strong>
                </div>
              </section>
            ) : null}
            {verification.disclaimer ? <p className="privacy-note">{verification.disclaimer}</p> : null}
            <p>
              Issued {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(verification.issuedAt))}.
              Share expires{" "}
              {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(verification.expiresAt))}.
            </p>
            <CheckList checks={verification.checks} />
          </Card>
        ) : (
          <Card className="verification-panel failure-panel">
            <div>
              <Badge tone="danger">Verification Failed</Badge>
              <h2>{failure.title}</h2>
              <p>{verification?.status === "invalid" ? verification.message : failure.detail}</p>
            </div>
            {verification?.status === "invalid" ? <CheckList checks={verification.checks} /> : null}
          </Card>
        )}
    </AppShell>
  );
}
