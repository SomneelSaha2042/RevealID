import { AppShell } from "../../components/app-shell";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <AppShell description="Create a holder wallet and receive academic credentials from an issuer." eyebrow="Holder" narrow title="Register">
      <RegisterForm />
    </AppShell>
  );
}
