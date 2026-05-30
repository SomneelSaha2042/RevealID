"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app-shell">
      <section className="workspace narrow-workspace">
        <div className="verification-panel failure-panel">
          <p className="status invalid">Something went wrong</p>
          <h1>RevealID could not load this view</h1>
          <p>Refresh the page or return to the previous workflow.</p>
          <button onClick={reset} type="button">
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
