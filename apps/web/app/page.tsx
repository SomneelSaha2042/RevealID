const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

async function getHealth() {
  try {
    const response = await fetch(`${apiBase}/health`, { cache: "no-store" });
    return response.ok ? "API reachable" : "API unavailable";
  } catch {
    return "API unavailable";
  }
}

export default async function Home() {
  const health = await getHealth();

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">RevealID</p>
        <h1>Credential wallet foundation</h1>
        <p className="lede">
          Gate 2 adds issuer-signed SD-JWT credentials, encrypted holder custody, public issuer keys, and a safe wallet
          list that never renders undisclosed marks.
        </p>
        <div className="actions">
          <a href="/issuer/issue">Issue credential</a>
          <a href="/wallet">Open wallet</a>
        </div>
        <div className="status">
          <span aria-hidden="true" />
          {health}
        </div>
      </section>
    </main>
  );
}
