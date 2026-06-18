import type { NormalizedOpenCertsClaims } from "@revealid/contracts";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapSaltedString = (value: string): unknown => {
  const match = value.match(/^[^:]+:(string|number|boolean):(.*)$/s);
  if (!match) return value;
  const [, type, rawValue] = match;
  if (type === "number") {
    const numeric = Number(rawValue);
    return Number.isNaN(numeric) ? rawValue : numeric;
  }
  if (type === "boolean") {
    return rawValue === "true";
  }
  return rawValue;
};

export const unwrapOpenAttestationValues = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map(unwrapOpenAttestationValues);
  }
  if (isRecord(input)) {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, unwrapOpenAttestationValues(value)])
    );
  }
  if (typeof input === "string") {
    return unwrapSaltedString(input);
  }
  return input;
};

const stringValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

export class AcademicClaimNormalizer {
  normalize(document: unknown): {
    claims: NormalizedOpenCertsClaims;
    originalIssuerName?: string;
    originalIdentityLocation?: string;
    sampleMode: boolean;
  } {
    const unwrapped = unwrapOpenAttestationValues(document);
    const data = isRecord(unwrapped) && isRecord(unwrapped.data) ? unwrapped.data : {};
    const recipient = isRecord(data.recipient) ? data.recipient : {};
    const issuer = Array.isArray(data.issuers) && isRecord(data.issuers[0]) ? data.issuers[0] : {};
    const identityProof = isRecord(issuer.identityProof) ? issuer.identityProof : {};
    const additionalData = isRecord(data.additionalData) ? data.additionalData : {};

    const transcript = Array.isArray(data.transcript)
      ? data.transcript
          .filter(isRecord)
          .map((entry) => ({
            courseCode: stringValue(entry.courseCode),
            name: stringValue(entry.name),
            grade: stringValue(entry.grade),
            semester: stringValue(entry.semester)
          }))
      : undefined;

    const claims: NormalizedOpenCertsClaims = {
      recipientName: stringValue(recipient.name),
      institution: stringValue(issuer.name),
      credentialName: stringValue(data.name),
      course: stringValue(recipient.course),
      issuedOn: stringValue(data.issuedOn),
      graduationDate: stringValue(data.graduationDate),
      transcript,
      additionalData: {
        merit: stringValue(additionalData.merit),
        studentId: stringValue(additionalData.studentId),
        transcriptId: stringValue(additionalData.transcriptId)
      }
    };

    if (!claims.transcript?.length) {
      delete claims.transcript;
    }
    if (!Object.values(claims.additionalData ?? {}).some(Boolean)) {
      delete claims.additionalData;
    }

    const originalIssuerName = stringValue(issuer.name);
    const originalIdentityLocation = stringValue(identityProof.location);

    return {
      claims,
      originalIssuerName,
      originalIdentityLocation,
      sampleMode: originalIssuerName === "Opencerts" && originalIdentityLocation === "dev.opencerts.io"
    };
  }
}
