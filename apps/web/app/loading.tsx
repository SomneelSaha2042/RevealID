import { Card } from "../components/ui/card";

export default function Loading() {
  return (
    <main className="app-shell">
      <section className="workspace narrow-workspace">
        <Card className="verification-panel">
          <p className="status">
            <span aria-hidden="true" />
            Loading
          </p>
          <p>Preparing the secure credential view.</p>
        </Card>
      </section>
    </main>
  );
}
