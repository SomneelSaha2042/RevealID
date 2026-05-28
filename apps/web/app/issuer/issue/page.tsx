import { IssueCredentialForm } from "./IssueCredentialForm";

export default function IssueCredentialPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <nav>
          <a href="/wallet">Wallet</a>
        </nav>
      </header>
      <section className="workspace">
        <div className="section-heading">
          <p className="eyebrow">Issuer</p>
          <h1>Issue credential</h1>
        </div>
        <IssueCredentialForm />
      </section>
    </main>
  );
}
