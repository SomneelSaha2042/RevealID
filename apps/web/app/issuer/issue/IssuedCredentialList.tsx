"use client";

import { useState } from "react";
import { Search, Trash2, Calendar } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredItems = items.filter((item) =>
    item.holderEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.credentialType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (items.length === 0) {
    return (
      <div className="glass-card p-12 rounded-2xl border border-dashed border-white/10 text-center">
        <p className="text-on-surface-variant text-lg">No credentials issued from this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table controls */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 flex-wrap gap-4">
        <h3 className="font-headline-md text-lg text-white font-bold">Issued Credential Audit Log</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm" size={16} />
            <input
              className="bg-charcoal-depth border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm outline-none focus:border-primary w-64 text-white placeholder:text-on-surface-variant"
              placeholder="Search recipient..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Responsive Table Wrapper */}
      <div className="glass-card rounded-xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-on-surface-variant border-b border-white/5 bg-charcoal-depth/50 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">CREDENTIAL ID</th>
                <th className="px-6 py-4 font-bold">RECIPIENT EMAIL</th>
                <th className="px-6 py-4 font-bold">TYPE</th>
                <th className="px-6 py-4 font-bold">TIMESTAMP</th>
                <th className="px-6 py-4 font-bold">STATUS</th>
                <th className="px-6 py-4 font-bold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-on-surface-variant font-medium">
              {filteredItems.map((credential) => {
                const revoked = Boolean(credential.revokedAt);
                return (
                  <tr className="hover:bg-white/5 transition-colors" data-testid="issued-credential-row" key={credential.id}>
                    <td className="px-6 py-4 font-mono text-xs text-primary font-bold">{credential.id.slice(0, 12)}...</td>
                    <td className="px-6 py-4 text-white">{credential.holderEmail}</td>
                    <td className="px-6 py-4">
                      <span className="bg-surface-container px-3 py-1 rounded-full text-xs border border-white/10 text-white">
                        {credential.credentialType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        <span>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.issuedAt))}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${revoked ? "text-error-red" : "text-success-green"}`}>
                        <span className={`w-2 h-2 rounded-full ${revoked ? "bg-error-red" : "bg-success-green pulse-success"}`}></span>
                        {revoked ? "Revoked" : "Active"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!revoked ? (
                        <button
                          onClick={() => revokeCredential(credential.id)}
                          className="px-4 py-2 bg-error-red/10 text-error-red border border-error-red/20 hover:bg-error-red hover:text-white rounded-lg transition-colors font-bold text-xs inline-flex items-center gap-1.5"
                          type="button"
                        >
                          <Trash2 size={12} />
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-on-surface-variant/40">Cancelled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {message ? <p className="text-sm font-bold text-error-red bg-error-red/10 border border-error-red/20 p-3 rounded-lg">{message}</p> : null}
    </div>
  );
}
