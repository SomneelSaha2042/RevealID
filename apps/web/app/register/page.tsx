import { AuthNav } from "../auth/AuthNav";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/">RevealID</a>
        <AuthNav />
      </header>
      <section className="workspace narrow-workspace">
        <div className="section-heading">
          <p className="eyebrow">Holder</p>
          <h1>Register</h1>
        </div>
        <RegisterForm />
      </section>
    </main>
  );
}
