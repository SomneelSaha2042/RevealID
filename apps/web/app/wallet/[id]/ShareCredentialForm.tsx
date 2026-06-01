"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "../../../components/ui/badge";
import { Button, ButtonLink } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, Input, Select } from "../../../components/ui/form";

type AcademicClaimKey = "degree" | "graduationYear" | "cgpa" | "marks";

type CredentialDetail = {
  id: string;
  claims: Record<AcademicClaimKey, string | number>;
};

type ShareResult = {
  verificationUrl: string;
  qrPayload: string;
  expiresAt: string;
  maxViews: number;
  disclosedClaims: AcademicClaimKey[];
};

const claimLabels: Record<AcademicClaimKey, string> = {
  degree: "Degree",
  graduationYear: "Graduation year",
  cgpa: "CGPA",
  marks: "Marks"
};

const claimKeys = Object.keys(claimLabels) as AcademicClaimKey[];

const getCsrfToken = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("rid_csrf="))
    ?.split("=")[1];

export function ShareCredentialForm({ credential }: { credential: CredentialDetail }) {
  const [selected, setSelected] = useState<AcademicClaimKey[]>(["degree", "graduationYear"]);
  const [ttlMinutes, setTtlMinutes] = useState(1440);
  const [maxViews, setMaxViews] = useState(1);
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const privateClaims = useMemo(
    () => claimKeys.filter((claim) => !selected.includes(claim)),
    [selected]
  );

  const toggleClaim = (claim: AcademicClaimKey) => {
    setSelected((current) =>
      current.includes(claim) ? current.filter((item) => item !== claim) : [...current, claim]
    );
  };

  async function createShare() {
    if (selected.length === 0) {
      setMessage("Select at least one field to share.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/credentials/share", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": getCsrfToken() ?? ""
        },
        body: JSON.stringify({
          credentialId: credential.id,
          claims: selected,
          audience: audience || undefined,
          ttlMinutes,
          maxViews
        })
      });

      if (!response.ok) {
        setMessage(response.status === 403 ? "Holder access is required." : "Share link could not be created.");
        return;
      }

      const body = (await response.json()) as { share: ShareResult };
      setResult(body.share);
    } catch {
      setMessage("Verifier link service is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="share-layout">
      <Card>
        <CardHeader>
          <CardTitle>Disclosure controls</CardTitle>
          <CardDescription>Select the exact fields that will appear in the verifier report.</CardDescription>
        </CardHeader>
        <CardContent>
          <section className="form-panel">
            <div className="field-list">
              {claimKeys.map((claim) => (
                <label className="checkbox-row" key={claim}>
                  <input checked={selected.includes(claim)} onChange={() => toggleClaim(claim)} type="checkbox" />
                  <span>{claimLabels[claim]}</span>
                  <strong>{credential.claims[claim]}</strong>
                </label>
              ))}
            </div>
            <div className="form-grid two">
              <Field>
                Expires in
                <Select value={ttlMinutes} onChange={(event) => setTtlMinutes(Number(event.target.value))}>
                  <option value={60}>1 hour</option>
                  <option value={1440}>1 day</option>
                  <option value={10080}>7 days</option>
                  <option value={43200}>30 days</option>
                </Select>
              </Field>
              <Field>
                Max views
                <Input min={1} max={100} onChange={(event) => setMaxViews(Number(event.target.value))} type="number" value={maxViews} />
              </Field>
            </div>
            <Field>
              Verifier audience
              <Input maxLength={240} onChange={(event) => setAudience(event.target.value)} placeholder="Optional verifier name or URL" value={audience} />
            </Field>
            <Button disabled={submitting} onClick={createShare} type="button">
              {submitting ? "Creating..." : "Create secure share"}
            </Button>
            {message ? <p className="form-message error">{message}</p> : null}
          </section>
        </CardContent>
      </Card>

      <section className="privacy-split" aria-label="Sharing privacy split">
        <div>
          <h2>Shared with Verifier</h2>
          <ul>
            {selected.map((claim) => (
              <li key={claim}>
                <span>{claimLabels[claim]}</span>
                <strong>{credential.claims[claim]}</strong>
              </li>
            ))}
            {selected.length === 0 ? <li>No claims selected.</li> : null}
          </ul>
        </div>
        <div>
          <h2>Kept Private</h2>
          <ul>
            {privateClaims.map((claim) => (
              <li key={claim}>
                <span>{claimLabels[claim]}</span>
                <strong>{credential.claims[claim]}</strong>
              </li>
            ))}
            {privateClaims.length === 0 ? <li>No private claims remain.</li> : null}
          </ul>
        </div>
      </section>

      {result ? (
        <Card className="share-result">
          <QRCodeSVG value={result.qrPayload} size={180} />
          <div>
            <Badge tone="success">Ready to verify</Badge>
            <h2>Verification link</h2>
            <ButtonLink href={result.verificationUrl} variant="ghost">
              {result.verificationUrl}
            </ButtonLink>
            <p>
              Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.expiresAt))}. Max views:{" "}
              {result.maxViews}.
            </p>
            <p className="privacy-note">Copy this link now. RevealID stores only a token hash, so the link cannot be shown again later.</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
