"use client";

import { useState } from "react";

type ShareHistoryItem = {
  id: string;
  credentialType: string;
  issuerName: string;
  audience: string;
  expiresAt: string;
  maxViews: number;
  views: number;
  revokedAt: string | null;
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
    return <p className="empty-state">No share links have been created.</p>;
  }

  return (
    <div className="credential-list">
      {items.map((share) => {
        const active = !share.revokedAt && new Date(share.expiresAt).getTime() > Date.now() && share.views < share.maxViews;
        return (
          <article className="credential-card share-history-card" key={share.id}>
            <div>
              <h2>{share.credentialType}</h2>
              <p>{share.issuerName}</p>
              <p>{share.audience}</p>
              <p>Shared: {share.disclosedClaims.join(", ")}</p>
            </div>
            <div className="card-actions">
              <span className={active ? "status-pill active" : "status-pill"}>
                {active ? "Active" : "Closed"}
              </span>
              <span>
                {share.views}/{share.maxViews} views
              </span>
              <time dateTime={share.expiresAt}>
                {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(share.expiresAt))}
              </time>
              {active ? (
                <button className="inline-action danger" onClick={() => cancelShare(share.id)} type="button">
                  Cancel
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
