import { cookies } from "next/headers";
import { AuthNav } from "../../auth/AuthNav";
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
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace">
        <div className="section-heading">
          <p className="eyebrow">Holder</p>
          <h1>Share history</h1>
        </div>
        {!authenticated ? <p className="empty-state">Sign in as a holder to manage share links.</p> : <ShareHistory shares={shares} />}
      </section>
    </main>
  );
}
