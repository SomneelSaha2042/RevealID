export default function Loading() {
  return (
    <main className="app-shell">
      <section className="workspace narrow-workspace">
        <div className="verification-panel">
          <p className="status">
            <span aria-hidden="true" />
            Loading
          </p>
          <p>Preparing the secure credential view.</p>
        </div>
      </section>
    </main>
  );
}
