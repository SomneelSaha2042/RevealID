import { cookies } from "next/headers";
import { AuthNav } from "../../auth/AuthNav";
import { ShareCredentialForm } from "./ShareCredentialForm";

type CredentialDetail = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: string;
  claims: {
    degree: string;
    graduationYear: number;
    cgpa: number;
    marks: number;
  };
};

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getCredential(id: string) {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/wallet/credentials/${id}`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { credential: CredentialDetail };
  return body.credential;
}

export default async function CredentialDetailPage({ params }: PageProps) {
  const { id } = await params;
  const credential = await getCredential(id);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace">
        <div className="section-heading">
          <p className="eyebrow">Holder</p>
          <h1>Share credential</h1>
        </div>
        {!credential ? (
          <p className="empty-state">Credential not found or sign-in expired.</p>
        ) : (
          <>
            <article className="credential-card detail-card">
              <div>
                <h2>{credential.credentialType}</h2>
                <p>{credential.issuerName}</p>
              </div>
              <time dateTime={credential.issuedAt}>
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(credential.issuedAt))}
              </time>
            </article>
            <ShareCredentialForm credential={credential} />
          </>
        )}
      </section>
    </main>
  );
}
