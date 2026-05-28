import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@revealid/contracts";

export type AccessTokenPayload = {
  sub: string;
  role: Role;
  sessionId: string;
  csrfToken: string;
};

export class TokenService {
  private readonly accessSecret: Uint8Array;

  constructor(accessTokenSecret: string) {
    this.accessSecret = new TextEncoder().encode(accessTokenSecret);
  }

  createOpaqueToken() {
    return randomBytes(32).toString("base64url");
  }

  createCsrfToken() {
    return randomBytes(32).toString("base64url");
  }

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async signAccessToken(payload: AccessTokenPayload) {
    return new SignJWT({ role: payload.role, sessionId: payload.sessionId, csrfToken: payload.csrfToken })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.accessSecret);
    if (!payload.sub || typeof payload.role !== "string" || typeof payload.sessionId !== "string" || typeof payload.csrfToken !== "string") {
      throw new Error("Invalid access token");
    }

    return {
      sub: payload.sub,
      role: payload.role as Role,
      sessionId: payload.sessionId,
      csrfToken: payload.csrfToken
    };
  }
}
