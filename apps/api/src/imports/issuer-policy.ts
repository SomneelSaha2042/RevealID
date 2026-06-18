import type { OpenCertsIssuerPolicyMode } from "@revealid/contracts";

export class IssuerPolicyError extends Error {
  constructor(message = "OpenCerts issuer policy failed") {
    super(message);
    this.name = "IssuerPolicyError";
  }
}

export class OpenCertsIssuerPolicy {
  enforce(
    mode: OpenCertsIssuerPolicyMode,
    source: {
      originalIssuerName?: string;
      originalIdentityLocation?: string;
      sampleMode: boolean;
    }
  ) {
    if (mode === "DEMO") {
      if (source.sampleMode) return;
      throw new IssuerPolicyError("Demo issuer policy only accepts the public OpenCerts demo issuer");
    }

    throw new IssuerPolicyError("Institution-only issuer policy is disabled until an approved issuer allowlist exists");
  }
}
