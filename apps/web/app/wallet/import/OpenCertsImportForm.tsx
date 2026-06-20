"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileJson, LockKeyhole, ShieldCheck, Upload, WalletCards } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button, ButtonLink } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import { formatClaimValue, labelForClaim } from "../claim-labels";

type VerificationSummary = {
  all: boolean;
  documentIntegrity: boolean;
  documentStatus: boolean;
  issuerIdentity: boolean;
};

type ImportVerifiedResponse = {
  importId: string;
  status: "verified";
  source: {
    type: string;
    sourceFileHash: string;
    verifiedAt: string;
    verificationMode: "LOCAL_TRUSTVC" | "OPENCERTS_API";
    issuerPolicyMode: "DEMO" | "INSTITUTION_ONLY";
    verification: VerificationSummary;
    originalIssuerName?: string;
    originalIdentityLocation?: string;
    sampleMode: boolean;
  };
  normalizedClaims: Record<string, string | number | undefined>;
  hiddenByDefault: string[];
  disclaimer: string;
};

type DeriveResponse = {
  credentialId: string;
  walletStatus: "STORED";
  credentialType: "RevealIDDerivedAcademicCredential";
  vct: "com.revealid.derivedAcademicCredential";
  hiddenByDefault: string[];
};

const getCsrfToken = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("rid_csrf="))
    ?.split("=")[1];

const verificationLabels: [keyof VerificationSummary, string][] = [
  ["documentIntegrity", "Document integrity"],
  ["documentStatus", "Document status"],
  ["issuerIdentity", "Issuer identity"]
];

export function OpenCertsImportForm() {
  const [ready, setReady] = useState(false);
  const [fileName, setFileName] = useState("sepolia.opencert");
  const [documentText, setDocumentText] = useState("");
  const [verificationMode, setVerificationMode] = useState<"LOCAL_TRUSTVC" | "OPENCERTS_API">("LOCAL_TRUSTVC");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportVerifiedResponse | null>(null);
  const [derived, setDerived] = useState<DeriveResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deriving, setDeriving] = useState(false);

  const visibleClaims = useMemo(
    () =>
      preview
        ? Object.entries(preview.normalizedClaims).filter(
            ([, value]) => typeof value === "string" || typeof value === "number"
          )
        : [],
    [preview]
  );

  useEffect(() => {
    setReady(true);
  }, []);

  async function readFile(file: File) {
    setFileName(file.name);
    setDocumentText(await file.text());
    setPreview(null);
    setDerived(null);
    setMessage("");
  }

  async function verifyImport() {
    setSubmitting(true);
    setMessage("");
    setPreview(null);
    setDerived(null);

    let document: Record<string, unknown>;
    try {
      document = JSON.parse(documentText) as Record<string, unknown>;
    } catch {
      setMessage("The selected file is not valid JSON.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/imports/opencerts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": getCsrfToken() ?? ""
        },
        body: JSON.stringify({
          fileName,
          document,
          verificationMode,
          issuerPolicyMode: "DEMO",
          retainEncryptedSource: false
        })
      });
      const body = await response.json();
      if (!response.ok || body.status !== "verified") {
        setMessage(body.message ?? body.error ?? "OpenCerts import could not be verified.");
        return;
      }
      setPreview(body as ImportVerifiedResponse);
    } catch {
      setMessage("OpenCerts import service is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deriveCredential() {
    if (!preview) return;
    setDeriving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/imports/opencerts/${preview.importId}/derive`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": getCsrfToken() ?? ""
        },
        body: JSON.stringify({ credentialTemplate: "GRADUATION_PROOF" })
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? "Credential could not be derived.");
        return;
      }
      setDerived(body as DeriveResponse);
    } catch {
      setMessage("Derived credential service is unavailable.");
    } finally {
      setDeriving(false);
    }
  }

  return (
    <div className="import-workflow">
      <section className="bridge-stage-list" aria-label="OpenCerts bridge stages">
        <div className="active">
          <Upload aria-hidden="true" size={18} />
          <span>1</span>
          <strong>Upload source</strong>
        </div>
        <div className={preview ? "active" : undefined}>
          <ShieldCheck aria-hidden="true" size={18} />
          <span>2</span>
          <strong>Verify and review</strong>
        </div>
        <div className={derived ? "active" : undefined}>
          <WalletCards aria-hidden="true" size={18} />
          <span>3</span>
          <strong>Store credential</strong>
        </div>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>OpenCerts source</CardTitle>
          <CardDescription>Upload a JSON `.opencert` file. RevealID verifies before claims are normalized or stored.</CardDescription>
        </CardHeader>
        <CardContent>
          <section className="form-panel">
            <Field>
              OpenCerts file
              <Input
                accept=".opencert,application/json"
                disabled={!ready}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                }}
                type="file"
              />
            </Field>
            <div className="form-grid two">
              <Field>
                File name
                <Input onChange={(event) => setFileName(event.target.value)} value={fileName} />
              </Field>
              <Field>
                Verification
                <Select
                  onChange={(event) =>
                    setVerificationMode(event.target.value as "LOCAL_TRUSTVC" | "OPENCERTS_API")
                  }
                  value={verificationMode}
                >
                  <option value="LOCAL_TRUSTVC">Local TrustVC</option>
                  <option value="OPENCERTS_API">OpenCerts API</option>
                </Select>
              </Field>
            </div>
            {verificationMode === "OPENCERTS_API" ? (
              <p className="form-message warning">
                OpenCerts API verification sends this uploaded document to an external verification service.
              </p>
            ) : null}
            <Field>
              Document JSON
              <Textarea onChange={(event) => setDocumentText(event.target.value)} value={documentText} />
            </Field>
            <Button disabled={!ready || submitting || documentText.length === 0} onClick={verifyImport} type="button">
              <ShieldCheck aria-hidden="true" size={16} />
              {submitting ? "Verifying..." : "Verify source"}
            </Button>
            {message ? <p className="form-message error">{message}</p> : null}
          </section>
        </CardContent>
      </Card>

      {preview ? (
        <section className="import-review" aria-label="Verified OpenCerts preview">
          <Card>
            <CardHeader>
              <CardTitle>Verified source</CardTitle>
              <CardDescription>{preview.source.originalIssuerName ?? preview.source.type}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="verification-grid">
                <div>
                  <ShieldCheck aria-hidden="true" size={18} />
                  <span>Overall source checks</span>
                  <Badge tone={preview.source.verification.all ? "success" : "warning"}>
                    {preview.source.verification.all ? "Complete" : "Partial"}
                  </Badge>
                </div>
                {verificationLabels.map(([key, label]) => (
                  <div key={key}>
                    <CheckCircle2 aria-hidden="true" size={18} />
                    <span>{label}</span>
                    <Badge tone={preview.source.verification[key] ? "success" : "warning"}>
                      {preview.source.verification[key] ? "Passed" : "Review"}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="provenance-panel compact">
                <div>
                  <span>Hash</span>
                  <strong>{preview.source.sourceFileHash.slice(0, 19)}...</strong>
                </div>
                <div>
                  <span>Verified</span>
                  <strong>
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                      new Date(preview.source.verifiedAt)
                    )}
                  </strong>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="privacy-split">
            <div>
              <h2>Ready to Share</h2>
              <ul>
                {visibleClaims.map(([key, value]) => (
                  <li key={key}>
                    <span>{labelForClaim(key)}</span>
                    <strong>{formatClaimValue(key, value as string | number)}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Hidden by Default</h2>
              <ul>
                {preview.hiddenByDefault.map((field) => (
                  <li key={field}>
                    <span>{field}</span>
                    <strong>
                      <LockKeyhole aria-hidden="true" size={14} />
                      Hidden
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Card className="derive-panel">
            <FileJson aria-hidden="true" size={24} />
            <div>
              <h2>Derived credential</h2>
              <p className="privacy-note">{preview.disclaimer}</p>
            </div>
            {derived ? (
              <ButtonLink href={`/wallet/${derived.credentialId}`} variant="secondary">
                <WalletCards aria-hidden="true" size={16} />
                Open credential
              </ButtonLink>
            ) : (
              <Button disabled={deriving} onClick={deriveCredential} type="button">
                <WalletCards aria-hidden="true" size={16} />
                {deriving ? "Storing..." : "Store in wallet"}
              </Button>
            )}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
