import { AuthNav } from "../auth/AuthNav";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace narrow-workspace">
        <div className="section-heading">
          <p className="eyebrow">Account</p>
          <h1>Sign in</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
