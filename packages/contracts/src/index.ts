import { z } from "zod";

export const roleSchema = z.enum(["HOLDER", "ISSUER"]);
export type Role = z.infer<typeof roleSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: roleSchema
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1).max(120)
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  csrfToken: z.string().min(32)
});

export const issueCredentialRequestSchema = z.object({
  holderEmail: z.string().email(),
  degree: z.string().min(1).max(160),
  graduationYear: z.number().int().min(1900).max(2200),
  cgpa: z.number().min(0).max(5),
  marks: z.number().int().min(0).max(10000)
});

export const issueCredentialResponseSchema = z.object({
  credential: z.object({
    id: z.string().uuid(),
    holderId: z.string().uuid(),
    issuerId: z.string().uuid(),
    credentialType: z.string(),
    issuerName: z.string(),
    issuedAt: z.string().datetime()
  })
});

export const walletCredentialSchema = z.object({
  id: z.string().uuid(),
  credentialType: z.string(),
  issuerName: z.string(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable()
});

export const walletCredentialListResponseSchema = z.object({
  credentials: z.array(walletCredentialSchema)
});

export const issuerCredentialSchema = z.object({
  id: z.string().uuid(),
  holderEmail: z.string().email(),
  credentialType: z.string(),
  issuerName: z.string(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable()
});

export const issuerCredentialListResponseSchema = z.object({
  credentials: z.array(issuerCredentialSchema)
});

export const academicClaimKeys = [
  "degree",
  "graduationYear",
  "cgpa",
  "marks",
  "recipientName",
  "institution",
  "credentialName",
  "course",
  "issuedOn",
  "graduationDate"
] as const;

export const academicClaimKeySchema = z.enum(academicClaimKeys);
export type AcademicClaimKey = z.infer<typeof academicClaimKeySchema>;

export const academicClaimValueSchema = z.union([z.string(), z.number()]);

export const createShareRequestSchema = z.object({
  credentialId: z.string().uuid(),
  claims: z.array(academicClaimKeySchema).min(1),
  audience: z.string().min(1).max(240).optional(),
  ttlMinutes: z.number().int().min(5).max(60 * 24 * 30),
  maxViews: z.number().int().min(1).max(100)
});

export const createShareResponseSchema = z.object({
  share: z.object({
    id: z.string().uuid(),
    verificationUrl: z.string().url(),
    qrPayload: z.string().url(),
    expiresAt: z.string().datetime(),
    maxViews: z.number().int(),
    disclosedClaims: z.array(academicClaimKeySchema)
  })
});

export const shareHistoryItemSchema = z.object({
  id: z.string().uuid(),
  credentialId: z.string().uuid(),
  credentialType: z.string(),
  issuerName: z.string(),
  audience: z.string(),
  expiresAt: z.string().datetime(),
  maxViews: z.number().int(),
  views: z.number().int(),
  revokedAt: z.string().datetime().nullable(),
  credentialExpiresAt: z.string().datetime().nullable(),
  credentialRevokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  disclosedClaims: z.array(academicClaimKeySchema)
});

export const shareHistoryResponseSchema = z.object({
  shares: z.array(shareHistoryItemSchema)
});

export const bridgeDisclaimer =
  "This is a RevealID-derived proof created from a user-provided OpenCerts file. It is not an official credential issued by the original institution.";

export const derivedSourceProvenanceSchema = z.object({
  sourceType: z.string().min(1),
  sourceFileHash: z.string().min(1),
  verifiedAt: z.string().datetime(),
  verification: z.object({
    all: z.boolean(),
    documentIntegrity: z.boolean(),
    documentStatus: z.boolean(),
    issuerIdentity: z.boolean()
  })
});

export const credentialDetailResponseSchema = z.object({
  credential: walletCredentialSchema.extend({
    claims: z.record(academicClaimKeySchema, academicClaimValueSchema),
    disclaimer: z.literal(bridgeDisclaimer).optional(),
    sourceProvenance: derivedSourceProvenanceSchema.optional()
  })
});

export const verifyShareResponseSchema = z.object({
  status: z.literal("verified"),
  credentialType: z.string(),
  issuerName: z.string(),
  issuedAt: z.string().datetime(),
  audience: z.string(),
  expiresAt: z.string().datetime(),
  claims: z.record(academicClaimKeySchema, academicClaimValueSchema),
  disclaimer: z.literal(bridgeDisclaimer).optional(),
  sourceProvenance: derivedSourceProvenanceSchema.optional()
});

export const verificationFailureCodeSchema = z.enum([
  "unknown",
  "malformed",
  "expired",
  "cancelled",
  "exhausted",
  "revoked",
  "tampered"
]);
export type VerificationFailureCode = z.infer<typeof verificationFailureCodeSchema>;

export const verificationCheckSchema = z.object({
  id: z.enum([
    "share_token",
    "share_state",
    "presentation_decryption",
    "issuer_signature",
    "disclosure_digests",
    "holder_binding",
    "audience",
    "nonce",
    "credential_expiry",
    "credential_status"
  ]),
  label: z.string(),
  status: z.enum(["passed", "failed", "skipped"])
});

export const verifyCredentialRequestSchema = z.object({
  token: z.string().min(1).max(512)
});

export const verifyCredentialResponseSchema = z.discriminatedUnion("status", [
  verifyShareResponseSchema.extend({
    checks: z.array(verificationCheckSchema)
  }),
  z.object({
    status: z.literal("invalid"),
    failureCode: verificationFailureCodeSchema,
    message: z.string(),
    checks: z.array(verificationCheckSchema)
  })
]);

export const issuerMetadataResponseSchema = z.object({
  issuer: z.string().url(),
  name: z.string().min(1),
  jwksUri: z.string().url(),
  credentialTypes: z.array(z.string().min(1))
});

export const opencertsVerificationModeSchema = z.enum(["LOCAL_TRUSTVC", "OPENCERTS_API"]);
export type OpenCertsVerificationMode = z.infer<typeof opencertsVerificationModeSchema>;

export const opencertsIssuerPolicyModeSchema = z.enum(["DEMO", "INSTITUTION_ONLY"]);
export type OpenCertsIssuerPolicyMode = z.infer<typeof opencertsIssuerPolicyModeSchema>;

export const opencertsSourceTypeSchema = z.enum(["OPENCERTS_V2", "OPENCERTS_V3", "UNKNOWN"]);
export type OpenCertsSourceType = z.infer<typeof opencertsSourceTypeSchema>;

export const opencertsImportStatusSchema = z.enum([
  "pending_verification",
  "verified",
  "failed",
  "derived"
]);
export type OpenCertsImportStatus = z.infer<typeof opencertsImportStatusSchema>;

export const importOpenCertsRequestSchema = z.object({
  fileName: z.string().min(1).max(240).refine((value: string) => value.toLowerCase().endsWith(".opencert"), {
    message: "fileName must end with .opencert"
  }),
  document: z.record(z.unknown()),
  verificationMode: opencertsVerificationModeSchema.optional(),
  issuerPolicyMode: opencertsIssuerPolicyModeSchema.optional(),
  retainEncryptedSource: z.boolean().optional()
});

export const opencertsHiddenByDefault = [
  "recipient.nric",
  "academicCredential.transcript",
  "academicCredential.additionalData.studentId",
  "academicCredential.additionalData.transcriptId"
] as const;

export const importOpenCertsPendingResponseSchema = z.object({
  importId: z.string().uuid(),
  status: z.literal("pending_verification"),
  source: z.object({
    type: opencertsSourceTypeSchema,
    sourceFileHash: z.string().min(1),
    verificationMode: opencertsVerificationModeSchema,
    issuerPolicyMode: opencertsIssuerPolicyModeSchema
  }),
  hiddenByDefault: z.array(z.string()),
  disclaimer: z.literal(bridgeDisclaimer)
});

export const opencertsVerificationSummarySchema = z.object({
  all: z.boolean(),
  documentIntegrity: z.boolean(),
  documentStatus: z.boolean(),
  issuerIdentity: z.boolean()
});
export type OpenCertsVerificationSummary = z.infer<typeof opencertsVerificationSummarySchema>;

export const normalizedOpenCertsClaimsSchema = z.object({
  recipientName: z.string().optional(),
  institution: z.string().optional(),
  credentialName: z.string().optional(),
  course: z.string().optional(),
  issuedOn: z.string().optional(),
  graduationDate: z.string().optional(),
  transcript: z
    .array(
      z.object({
        courseCode: z.string().optional(),
        name: z.string().optional(),
        grade: z.string().optional(),
        semester: z.string().optional()
      })
    )
    .optional(),
  additionalData: z
    .object({
      merit: z.string().optional(),
      studentId: z.string().optional(),
      transcriptId: z.string().optional()
    })
    .optional()
});
export type NormalizedOpenCertsClaims = z.infer<typeof normalizedOpenCertsClaimsSchema>;

export const importOpenCertsVerifiedResponseSchema = z.object({
  importId: z.string().uuid(),
  status: z.literal("verified"),
  source: z.object({
    type: opencertsSourceTypeSchema,
    sourceFileHash: z.string().min(1),
    verifiedAt: z.string().datetime(),
    verificationMode: opencertsVerificationModeSchema,
    issuerPolicyMode: opencertsIssuerPolicyModeSchema,
    verification: opencertsVerificationSummarySchema,
    originalIssuerName: z.string().optional(),
    originalIdentityLocation: z.string().optional(),
    sampleMode: z.boolean()
  }),
  normalizedClaims: normalizedOpenCertsClaimsSchema,
  hiddenByDefault: z.array(z.string()),
  disclaimer: z.literal(bridgeDisclaimer)
});

export const importOpenCertsFailureResponseSchema = z.object({
  status: z.literal("invalid"),
  failureCode: z.enum([
    "malformed_source",
    "unsupported_source_type",
    "source_verification_failed",
    "issuer_policy_failed",
    "external_verification_unavailable"
  ]),
  message: z.string(),
  importId: z.string().uuid().optional(),
  sourceFileHash: z.string().optional(),
  verification: opencertsVerificationSummarySchema.optional()
});

export const importOpenCertsResponseSchema = z.discriminatedUnion("status", [
  importOpenCertsPendingResponseSchema,
  importOpenCertsVerifiedResponseSchema,
  importOpenCertsFailureResponseSchema
]);

export const deriveFromOpenCertsImportRequestSchema = z.object({
  credentialTemplate: z.enum(["GRADUATION_PROOF", "INSTITUTION_COURSE_PROOF", "CUSTOM"])
});

export const deriveFromOpenCertsImportResponseSchema = z.object({
  credentialId: z.string().uuid(),
  walletStatus: z.literal("STORED"),
  credentialType: z.literal("RevealIDDerivedAcademicCredential"),
  vct: z.literal("com.revealid.derivedAcademicCredential"),
  hiddenByDefault: z.array(z.string())
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type IssueCredentialRequest = z.infer<typeof issueCredentialRequestSchema>;
export type IssueCredentialResponse = z.infer<typeof issueCredentialResponseSchema>;
export type WalletCredential = z.infer<typeof walletCredentialSchema>;
export type WalletCredentialListResponse = z.infer<typeof walletCredentialListResponseSchema>;
export type IssuerCredential = z.infer<typeof issuerCredentialSchema>;
export type IssuerCredentialListResponse = z.infer<typeof issuerCredentialListResponseSchema>;
export type CredentialDetailResponse = z.infer<typeof credentialDetailResponseSchema>;
export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;
export type CreateShareResponse = z.infer<typeof createShareResponseSchema>;
export type ShareHistoryItem = z.infer<typeof shareHistoryItemSchema>;
export type ShareHistoryResponse = z.infer<typeof shareHistoryResponseSchema>;
export type VerifyShareResponse = z.infer<typeof verifyShareResponseSchema>;
export type VerificationCheck = z.infer<typeof verificationCheckSchema>;
export type VerifyCredentialRequest = z.infer<typeof verifyCredentialRequestSchema>;
export type VerifyCredentialResponse = z.infer<typeof verifyCredentialResponseSchema>;
export type IssuerMetadataResponse = z.infer<typeof issuerMetadataResponseSchema>;
export type ImportOpenCertsRequest = z.infer<typeof importOpenCertsRequestSchema>;
export type ImportOpenCertsPendingResponse = z.infer<typeof importOpenCertsPendingResponseSchema>;
export type ImportOpenCertsVerifiedResponse = z.infer<typeof importOpenCertsVerifiedResponseSchema>;
export type ImportOpenCertsFailureResponse = z.infer<typeof importOpenCertsFailureResponseSchema>;
export type ImportOpenCertsResponse = z.infer<typeof importOpenCertsResponseSchema>;
export type DeriveFromOpenCertsImportRequest = z.infer<typeof deriveFromOpenCertsImportRequestSchema>;
export type DeriveFromOpenCertsImportResponse = z.infer<typeof deriveFromOpenCertsImportResponseSchema>;
