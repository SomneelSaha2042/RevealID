"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileJson, LockKeyhole, ShieldCheck, Upload, WalletCards, KeyRound } from "lucide-react";
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
    <div className="space-y-12">
      {/* Progress Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 relative">
        <div className="flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-full step-gradient flex items-center justify-center text-on-primary font-bold text-lg shadow-[0_0_20px_rgba(34,211,238,0.3)]">1</div>
          <div>
            <p className="font-label-md text-primary text-xs uppercase tracking-wider">Step 1</p>
            <p className="font-headline-md text-lg text-white font-bold">Upload Source</p>
          </div>
        </div>
        <div className={`flex items-center gap-4 transition-all duration-300 ${preview ? "opacity-100 grayscale-0" : "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${preview ? "step-gradient text-on-primary shadow-[0_0_20px_rgba(34,211,238,0.3)]" : "bg-surface-container text-on-surface-variant border-white/10"}`}>2</div>
          <div>
            <p className={`font-label-md text-xs uppercase tracking-wider ${preview ? "text-primary" : "text-on-surface-variant"}`}>Step 2</p>
            <p className="font-headline-md text-lg text-white font-bold">Verify Integrity</p>
          </div>
        </div>
        <div className={`flex items-center gap-4 transition-all duration-300 ${derived ? "opacity-100 grayscale-0" : "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${derived ? "step-gradient text-on-primary shadow-[0_0_20px_rgba(34,211,238,0.3)]" : "bg-surface-container text-on-surface-variant border-white/10"}`}>3</div>
          <div>
            <p className={`font-label-md text-xs uppercase tracking-wider ${derived ? "text-primary" : "text-on-surface-variant"}`}>Step 3</p>
            <p className="font-headline-md text-lg text-white font-bold">Derive Credential</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Checklist */}
        <div className="lg:col-span-7 space-y-8">
          {/* Drag and Drop Zone */}
          <div className="glass-card rounded-xl border-2 border-dashed border-primary/30 p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-all group relative overflow-hidden">
            <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div className="mb-6 w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload aria-hidden="true" size={36} />
            </div>
            <h3 className="font-headline-md text-white mb-2 text-xl font-bold">
              {fileName ? `File Selected: ${fileName}` : "Drop OpenCert file here"}
            </h3>
            <p className="text-on-surface-variant font-body-md mb-6 text-sm">Support .json and .opencert formats (max 5MB)</p>
            <label className="bg-white/10 border border-white/10 px-8 py-3 rounded-lg text-white font-label-md hover:bg-white/20 transition-all cursor-pointer font-bold">
              Browse Files
              <input
                accept=".opencert,application/json"
                disabled={!ready}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                }}
                type="file"
              />
            </label>
          </div>

          {/* Form Settings inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="text-on-surface-variant text-label-sm uppercase mb-2 block font-bold text-xs">File Name</label>
              <input
                className="w-full bg-charcoal-depth border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                disabled={!ready}
                onChange={(event) => setFileName(event.target.value)}
                value={fileName}
              />
            </div>
            <div>
              <label className="text-on-surface-variant text-label-sm uppercase mb-2 block font-bold text-xs">Verification Mode</label>
              <select
                className="w-full bg-charcoal-depth border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                disabled={!ready}
                onChange={(event) =>
                  setVerificationMode(event.target.value as "LOCAL_TRUSTVC" | "OPENCERTS_API")
                }
                value={verificationMode}
              >
                <option value="LOCAL_TRUSTVC">Local TrustVC</option>
                <option value="OPENCERTS_API">OpenCerts API (External)</option>
              </select>
            </div>
          </div>

          {/* Security Verification Checklist */}
          <div className="glass-card p-8 rounded-xl">
            <h3 className="font-headline-md text-white mb-6 flex items-center gap-3 font-bold text-lg">
              <ShieldCheck className="text-electric-cyan" size={24} />
              Security-First Verification
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-white/5">
                <div className="flex items-center gap-4">
                  <ShieldCheck className={preview ? (preview.source.verification.documentIntegrity ? "text-success-green" : "text-error-red") : "text-on-surface-variant"} size={20} />
                  <span className="text-on-surface-variant">Hash Integrity Checksum</span>
                </div>
                <span className={`text-label-sm uppercase tracking-wider font-bold text-xs ${preview ? (preview.source.verification.documentIntegrity ? "text-success-green" : "text-error-red") : "text-on-surface-variant"}`}>
                  {preview ? (preview.source.verification.documentIntegrity ? "Passed" : "Failed") : "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-white/5">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className={preview ? (preview.source.verification.documentStatus ? "text-success-green" : "text-error-red") : "text-on-surface-variant"} size={20} />
                  <span className="text-on-surface-variant">Merkle Root Validation</span>
                </div>
                <span className={`text-label-sm uppercase tracking-wider font-bold text-xs ${preview ? (preview.source.verification.documentStatus ? "text-success-green" : "text-error-red") : "text-on-surface-variant"}`}>
                  {preview ? (preview.source.verification.documentStatus ? "Passed" : "Failed") : "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-white/5">
                <div className="flex items-center gap-4">
                  <KeyRound className={preview ? (preview.source.verification.issuerIdentity ? "text-success-green" : "text-error-red") : "text-on-surface-variant"} size={20} />
                  <span className="text-on-surface-variant">Issuer Identity Resolution (DID)</span>
                </div>
                <span className={`text-label-sm uppercase tracking-wider font-bold text-xs ${preview ? (preview.source.verification.issuerIdentity ? "text-success-green" : "text-error-red") : "text-on-surface-variant"}`}>
                  {preview ? (preview.source.verification.issuerIdentity ? "Passed" : "Failed") : "Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Data Preview */}
        <div className="lg:col-span-5 flex flex-col h-full justify-between">
          <div className="glass-card p-8 rounded-xl flex-grow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline-md text-white font-bold text-lg">Document Source JSON</h3>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-error-red/50"></div>
                  <div className="w-3 h-3 rounded-full bg-tertiary/50"></div>
                  <div className="w-3 h-3 rounded-full bg-success-green/50"></div>
                </div>
              </div>
              <textarea
                className="w-full h-80 bg-charcoal-depth/50 rounded-lg p-6 font-mono text-sm text-primary/80 overflow-y-auto custom-scrollbar border border-white/5 shadow-inner focus:outline-none resize-none"
                placeholder='Paste OpenCerts JSON document here or upload a file...'
                value={documentText}
                onChange={(e) => {
                  setDocumentText(e.target.value);
                  setPreview(null);
                  setDerived(null);
                  setMessage("");
                }}
              />
            </div>
            <div className="mt-8 space-y-4">
              {verificationMode === "OPENCERTS_API" ? (
                <p className="text-xs text-warning leading-relaxed bg-warning-soft/10 p-3 rounded-lg border border-warning/20">
                  OpenCerts API verification sends this uploaded document to an external verification service.
                </p>
              ) : null}
              {message ? (
                <p className="text-error-red font-bold text-sm bg-error-red/10 border border-error-red/20 p-3 rounded-lg">
                  {message}
                </p>
              ) : null}
              <button
                className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline-md text-lg hover:scale-[1.01] transition-transform shadow-[0_0_30px_rgba(137,206,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                disabled={!ready || submitting || documentText.length === 0}
                onClick={verifyImport}
                type="button"
              >
                {submitting ? "Verifying..." : "Start Verification"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Verified OpenCerts Preview Details */}
      {preview ? (
        <section className="mt-12 space-y-8" aria-label="Verified OpenCerts preview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Claims Ready to Share */}
            <div className="glass-card p-8 rounded-xl">
              <h3 className="font-headline-md text-white mb-6 font-bold text-lg">Claims Ready to Share</h3>
              <ul className="space-y-4">
                {visibleClaims.map(([key, value]) => (
                  <li key={key} className="flex justify-between items-center p-3 bg-surface-container-low rounded-lg border border-white/5">
                    <span className="text-on-surface-variant text-sm font-medium">{labelForClaim(key)}</span>
                    <strong className="text-white font-bold">{formatClaimValue(key, value as string | number)}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hidden by Default */}
            <div className="glass-card p-8 rounded-xl">
              <h3 className="font-headline-md text-white mb-6 font-bold text-lg">Hidden by Default</h3>
              <ul className="space-y-4">
                {preview.hiddenByDefault.map((field) => (
                  <li key={field} className="flex justify-between items-center p-3 bg-surface-container-low rounded-lg border border-white/5 border-dashed border-white/10">
                    <span className="text-on-surface-variant/70 text-sm">{field}</span>
                    <strong className="text-on-surface-variant/40 flex items-center gap-2 font-normal text-sm">
                      <LockKeyhole size={14} />
                      Hidden
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Derivation / Wallet Storage Action */}
          <div className="glass-card p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 mt-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
                <FileJson size={32} />
              </div>
              <div>
                <h3 className="font-headline-md text-white text-lg font-bold mb-1">Derived RevealID credential</h3>
                <p className="text-on-surface-variant text-sm">{preview.disclaimer}</p>
              </div>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              {derived ? (
                <a
                  href={`/wallet/${derived.credentialId}`}
                  className="w-full md:w-auto bg-success-green text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                >
                  <WalletCards aria-hidden="true" size={20} />
                  Open derived credential
                </a>
              ) : (
                <button
                  className="w-full md:w-auto bg-primary text-on-primary px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
                  disabled={deriving}
                  onClick={deriveCredential}
                  type="button"
                >
                  <WalletCards aria-hidden="true" size={20} />
                  {deriving ? "Storing..." : "Store in wallet"}
                </button>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

