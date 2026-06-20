import { AppShell } from "../../../components/app-shell";
import { OpenCertsImportForm } from "./OpenCertsImportForm";

export default function ImportOpenCertsPage() {
  return (
    <AppShell
      description="Verify a holder-provided OpenCerts file, review normalized claims, and store a RevealID-derived credential for selective disclosure."
      eyebrow="OpenCerts bridge"
      title="Import and derive"
    >
      <OpenCertsImportForm />
    </AppShell>
  );
}
