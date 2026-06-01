import { AuthNav } from "./auth/AuthNav";
import { ButtonLink } from "../components/ui/button";
import { Card } from "../components/ui/card";

export default function NotFound() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace narrow-workspace">
        <Card className="verification-panel failure-panel">
          <p className="status invalid">Not Found</p>
          <h1>Credential view unavailable</h1>
          <p>The link may be incomplete, expired, or unavailable to this session.</p>
          <ButtonLink href="/" variant="secondary">
            Return home
          </ButtonLink>
        </Card>
      </section>
    </main>
  );
}
