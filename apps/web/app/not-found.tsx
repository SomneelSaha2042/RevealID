import { AuthNav } from "./auth/AuthNav";

export default function NotFound() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace narrow-workspace">
        <div className="verification-panel failure-panel">
          <p className="status invalid">Not Found</p>
          <h1>Credential view unavailable</h1>
          <p>The link may be incomplete, expired, or unavailable to this session.</p>
          <a className="inline-action" href="/">
            Return home
          </a>
        </div>
      </section>
    </main>
  );
}
