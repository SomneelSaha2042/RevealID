"use client";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app-shell">
      <section className="workspace narrow-workspace">
        <Card className="verification-panel failure-panel">
          <p className="status invalid">Something went wrong</p>
          <h1>RevealID could not load this view</h1>
          <p>Refresh the page or return to the previous workflow.</p>
          <Button onClick={reset} type="button">
            Try again
          </Button>
        </Card>
      </section>
    </main>
  );
}
