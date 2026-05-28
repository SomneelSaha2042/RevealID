import { cookies } from "next/headers";
import { AuthNav } from "../auth/AuthNav";

type WalletCredential = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: string;
};

async function getCredentials() {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/wallet/credentials`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return { credentials: [] as WalletCredential[], authenticated: false };
  }

  if (!response.ok) {
    return { credentials: [] as WalletCredential[], authenticated: false };
  }

  return { ...(await response.json()), authenticated: true } as {
    credentials: WalletCredential[];
    authenticated: boolean;
  };
}

export default async function WalletPage() {
  const { credentials, authenticated } = await getCredentials();

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace">
        <div className="section-heading">
          <p className="eyebrow">Holder</p>
          <h1>Wallet</h1>
        </div>
        {!authenticated ? <p className="empty-state">Sign in as a holder to view wallet credentials.</p> : null}
        {authenticated && credentials.length === 0 ? <p className="empty-state">No credentials in this wallet.</p> : null}
        {credentials.length > 0 ? (
          <div className="credential-list">
            {credentials.map((credential) => (
              <article className="credential-card" key={credential.id}>
                <div>
                  <h2>{credential.credentialType}</h2>
                  <p>{credential.issuerName}</p>
                </div>
                <time dateTime={credential.issuedAt}>
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.issuedAt))}
                </time>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
