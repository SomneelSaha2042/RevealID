"use client";

import { useMemo, useState } from "react";
import { Search, Calendar, CheckCircle2, Lock, Eye, Trash2, ShieldAlert } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");

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

  const processedItems = useMemo(() => {
    return items.filter((item) =>
      item.audience.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.credentialType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // Bento Stats calculations
  const totalShares = items.length;
  const activeLinks = useMemo(() => {
    return items.filter((share) => {
      const shareExpired = new Date(share.expiresAt).getTime() <= Date.now();
      const credentialExpired = share.credentialExpiresAt
        ? new Date(share.credentialExpiresAt).getTime() <= Date.now()
        : false;
      return (
        !share.revokedAt &&
        !share.credentialRevokedAt &&
        !shareExpired &&
        !credentialExpired &&
        share.views < share.maxViews
      );
    }).length;
  }, [items]);

  const mostSharedCredential = useMemo(() => {
    if (items.length === 0) return "None";
    const counts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.credentialType] = (acc[item.credentialType] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a), ["None", 0])[0];
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="glass-card p-12 rounded-2xl border border-dashed border-white/10 text-center">
        <p className="text-on-surface-variant text-lg">No share links have been created.</p>
        <p className="text-on-surface-variant/60 text-sm mt-2">When you share credential claims, they will be listed here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-on-surface-variant/80 bg-surface-container-low p-4 rounded-xl border border-white/5 leading-relaxed">
        Share links are shown only when created. RevealID stores secure hashes of share tokens, not the recoverable links themselves.
      </p>

      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2 bg-surface-container-high rounded-lg px-4 py-2 border border-white/10 focus-within:border-primary transition-all w-full md:w-80">
          <Search size={18} className="text-on-surface-variant" />
          <input
            className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-full placeholder:text-on-surface-variant text-white"
            placeholder="Search destination..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Overview (Bento Style) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-xl col-span-1">
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-2">Total Shares</p>
          <h3 className="font-headline-md text-3xl font-bold text-electric-cyan">{totalShares}</h3>
        </div>
        <div className="glass-card p-6 rounded-xl col-span-1">
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-2">Active Links</p>
          <h3 className="font-headline-md text-3xl font-bold text-secondary">{activeLinks}</h3>
        </div>
        <div className="glass-card p-6 rounded-xl col-span-2 relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-2">Most Shared Credential</p>
            <h3 className="font-headline-md text-2xl font-bold text-primary truncate">{mostSharedCredential}</h3>
          </div>
        </div>
      </div>

      {/* Disclosure List */}
      <div className="space-y-6">
        {processedItems.map((share) => {
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
            ? "Revoked by Issuer"
            : credentialExpired
              ? "Credential Expired"
              : share.revokedAt
                ? "Cancelled"
                : shareExpired
                  ? "Expired"
                  : share.views >= share.maxViews
                    ? "Used"
                    : "Active";

          return (
            <div className={`glass-card p-6 rounded-xl transition-all flex flex-col md:flex-row gap-6 items-start ${!active ? "opacity-70" : ""}`} key={share.id}>
              <div className="h-12 w-12 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-white/10 text-primary">
                <Eye size={24} />
              </div>
              <div className="flex-grow w-full">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                  <div>
                    <h4 className="font-headline-md text-lg text-white font-bold mb-1">{share.audience}</h4>
                    <div className="flex items-center gap-2 text-on-surface-variant text-xs font-medium">
                      <Calendar size={14} />
                      <span>{share.credentialType} ({share.issuerName})</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${active ? "bg-success-green/10 text-success-green border-success-green/20" : "bg-white/5 text-on-surface-variant border-white/10"}`}>
                    {!active ? <ShieldAlert size={12} /> : <CheckCircle2 size={12} />}
                    <span>{statusLabel}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {share.disclosedClaims.map((claim) => (
                    <span key={claim} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-md text-xs font-medium">
                      {claim}
                    </span>
                  ))}
                  <span className="bg-white/5 text-on-surface-variant/40 border border-dashed border-white/10 px-3 py-1 rounded-md text-xs flex items-center gap-1">
                    <Lock size={10} />
                    Undisclosed Fields (Hidden)
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap justify-between items-center text-xs text-on-surface-variant font-medium gap-4">
                  <span>Views: {share.views} / {share.maxViews}</span>
                  <span className="flex items-center gap-1">
                    Expires: {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(share.expiresAt))}
                  </span>
                </div>
              </div>

              {active ? (
                <div className="flex md:flex-col gap-2 shrink-0 self-stretch md:self-start justify-end mt-4 md:mt-0">
                  <button
                    onClick={() => cancelShare(share.id)}
                    className="p-3 text-error-red hover:bg-error-red/10 rounded-lg transition-colors flex items-center gap-2 font-bold text-sm md:w-full"
                    type="button"
                  >
                    <Trash2 size={16} />
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
