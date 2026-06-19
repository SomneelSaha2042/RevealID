import { AppShell } from "../../../components/app-shell";
import { OpenCertsImportForm } from "./OpenCertsImportForm";

export default function ImportOpenCertsPage() {
  return (
    <AppShell
      description="Import an OpenCerts source file, review verified claims, and derive a RevealID wallet credential."
      eyebrow="Holder"
      title="Import OpenCerts"
    >
      <OpenCertsImportForm />
    </AppShell>
  );
}
