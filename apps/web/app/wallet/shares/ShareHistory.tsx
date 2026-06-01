"use client";

import { useState } from "react";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";

type ShareHistoryItem = {
  id: string;
  credentialType: string;
  issuerName: string;
  audience: string;
  expiresAt: string;
  maxViews: number;
  views: number;
  revokedAt: string | null;
  credentialExpiresAt: string | null;
  credentialRevokedAt: string | null;
  disclosedClaims: string[];
};

const getCsrfToken = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("rid_csrf="))
    ?.split("=")[1];

export function ShareHistory({ shares }: { shares: ShareHistoryItem[] }) {
  const [items, setItems] = useState(shares);

  async function cancelShare(id: string) {
    const response = await fetch(`/api/shares/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() ?? "" }
    });
    if (response.ok) {
      setItems((current) =>
        current.map((share) => (share.id === id ? { ...share, revokedAt: new Date().toISOString() } : share))
      );
    }
  }

  if (items.length === 0) {
    return <EmptyState>No share links have been created.</EmptyState>;
  }

  return (
    <>
      <p className="privacy-note">Share links are shown only when created. RevealID stores token hashes, not recoverable links.</p>
      <div className="credential-list">
        {items.map((share) => {
          const shareExpired = new Date(share.expiresAt).getTime() <= Date.now();
          const credentialExpired = share.credentialExpiresAt
            ? new Date(share.credentialExpiresAt).getTime() <= Date.now()
            : false;
          const active =
            !share.revokedAt &&
            !share.credentialRevokedAt &&
            !shareExpired &&
            !credentialExpired &&
            share.views < share.maxViews;
          const statusLabel = share.credentialRevokedAt
            ? "Credential revoked"
            : credentialExpired
              ? "Credential expired"
              : share.revokedAt
                ? "Cancelled"
                : shareExpired
                  ? "Expired"
                  : share.views >= share.maxViews
                    ? "Used"
                    : "Active";
          return (
            <Card className="credential-card share-history-card" key={share.id}>
              <div>
                <h2>{share.credentialType}</h2>
                <p>{share.issuerName}</p>
                <p>{share.audience}</p>
                <p>Shared: {share.disclosedClaims.join(", ")}</p>
                {share.credentialRevokedAt ? <p>Issuer revoked this credential.</p> : null}
              </div>
              <div className="card-actions">
                <Badge tone={active ? "success" : "neutral"}>
                  {statusLabel}
                </Badge>
                <span>
                  {share.views}/{share.maxViews} views
                </span>
                <time dateTime={share.expiresAt}>
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(share.expiresAt))}
                </time>
                {active ? (
                  <Button onClick={() => cancelShare(share.id)} type="button" variant="danger">
                    Cancel
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
