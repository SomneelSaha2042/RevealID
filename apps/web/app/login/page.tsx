import { AppShell } from "../../components/app-shell";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <AppShell
      description="Access your issuer console or holder wallet with secure cookie-based authentication."
      eyebrow="Account"
      narrow
      title="Sign in"
    >
      <LoginForm />
    </AppShell>
  );
}
