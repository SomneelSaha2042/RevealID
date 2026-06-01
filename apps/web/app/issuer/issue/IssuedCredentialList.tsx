"use client";

import { useState } from "react";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";

type IssuedCredential = {
  id: string;
  holderEmail: string;
  credentialType: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

const getCsrfToken = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("rid_csrf="))
    ?.split("=")[1];

export function IssuedCredentialList({ credentials }: { credentials: IssuedCredential[] }) {
  const [items, setItems] = useState(credentials);
  const [message, setMessage] = useState("");

  async function revokeCredential(id: string) {
    setMessage("");
    const response = await fetch(`/api/credentials/${id}/revoke`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrfToken() ?? "" }
    });

    if (!response.ok) {
      setMessage("Credential could not be revoked.");
      return;
    }

    const body = (await response.json()) as { credential: { id: string; revokedAt: string } };
    setItems((current) =>
      current.map((credential) =>
        credential.id === body.credential.id ? { ...credential, revokedAt: body.credential.revokedAt } : credential
      )
    );
  }

  if (items.length === 0) {
    return <EmptyState>No credentials issued from this account.</EmptyState>;
  }

  return (
    <div className="credential-list">
      {items.map((credential) => {
        const revoked = Boolean(credential.revokedAt);
        return (
          <Card className="credential-card share-history-card" key={credential.id}>
            <div>
              <h2>{credential.credentialType}</h2>
              <p>{credential.holderEmail}</p>
              <p>
                Issued {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.issuedAt))}
                {credential.expiresAt
                  ? ` - Expires ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.expiresAt))}`
                  : ""}
              </p>
            </div>
            <div className="card-actions">
              <Badge tone={revoked ? "neutral" : "success"}>{revoked ? "Revoked" : "Active"}</Badge>
              {!revoked ? (
                <Button onClick={() => revokeCredential(credential.id)} type="button" variant="danger">
                  Revoke
                </Button>
              ) : null}
            </div>
          </Card>
        );
      })}
      {message ? <p className="form-message error">{message}</p> : null}
    </div>
  );
}
