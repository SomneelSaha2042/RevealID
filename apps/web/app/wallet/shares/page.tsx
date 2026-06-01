import { cookies } from "next/headers";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
import { ShareHistory } from "./ShareHistory";

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

async function getShares() {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/shares`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return { shares: [] as ShareHistoryItem[], authenticated: false };
  }

  if (!response.ok) {
    return { shares: [] as ShareHistoryItem[], authenticated: false };
  }

  return { ...(await response.json()), authenticated: true } as {
    shares: ShareHistoryItem[];
    authenticated: boolean;
  };
}

export default async function ShareHistoryPage() {
  const { shares, authenticated } = await getShares();

  return (
    <AppShell
      description="Review active, expired, cancelled, and used shares without exposing raw share tokens."
      eyebrow="Holder"
      title="Share history"
    >
      {!authenticated ? <EmptyState>Sign in as a holder to manage share links.</EmptyState> : <ShareHistory shares={shares} />}
    </AppShell>
  );
}
