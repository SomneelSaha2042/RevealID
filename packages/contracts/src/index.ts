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

export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
