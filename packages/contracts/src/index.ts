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
  issuedAt: z.string().datetime()
});

export const walletCredentialListResponseSchema = z.object({
  credentials: z.array(walletCredentialSchema)
});

export const issuerMetadataResponseSchema = z.object({
  issuer: z.string().url(),
  name: z.string().min(1),
  jwksUri: z.string().url(),
  credentialTypes: z.array(z.string().min(1))
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type IssueCredentialRequest = z.infer<typeof issueCredentialRequestSchema>;
export type IssueCredentialResponse = z.infer<typeof issueCredentialResponseSchema>;
export type WalletCredential = z.infer<typeof walletCredentialSchema>;
export type WalletCredentialListResponse = z.infer<typeof walletCredentialListResponseSchema>;
export type IssuerMetadataResponse = z.infer<typeof issuerMetadataResponseSchema>;
