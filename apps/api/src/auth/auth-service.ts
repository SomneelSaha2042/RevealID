import argon2 from "argon2";
import type { AuthUser, LoginRequest, RegisterRequest } from "@revealid/contracts";
import type { Prisma } from "../db.js";
import { TokenService } from "./token-service.js";

const refreshTtlMs = 1000 * 60 * 60 * 24 * 30;

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

export class AuthService {
  constructor(
    private readonly prisma: Prisma,
    private readonly tokens: TokenService
  ) {}

  async register(input: RegisterRequest): Promise<AuthSession> {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: "HOLDER",
        passwordHash
      }
    });

    return this.createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  }

  async login(input: LoginRequest): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new Error("Invalid credentials");
    }

    return this.createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const tokenHash = this.tokens.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true }
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new Error("Invalid refresh token");
    }

    const newRefreshToken = this.tokens.createOpaqueToken();
    const csrfToken = this.tokens.createCsrfToken();
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        tokenHash: this.tokens.hashToken(newRefreshToken),
        csrfToken,
        rotatedAt: new Date(),
        expiresAt: new Date(Date.now() + refreshTtlMs)
      }
    });

    const user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role
    };
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      sessionId: session.id,
      csrfToken
    });
    return { user, accessToken, refreshToken: newRefreshToken, csrfToken };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }
    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: this.tokens.hashToken(refreshToken),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  private async createSession(user: AuthUser): Promise<AuthSession> {
    const refreshToken = this.tokens.createOpaqueToken();
    const csrfToken = this.tokens.createCsrfToken();
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashToken(refreshToken),
        csrfToken,
        expiresAt: new Date(Date.now() + refreshTtlMs)
      }
    });
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      sessionId: session.id,
      csrfToken
    });

    return { user, accessToken, refreshToken, csrfToken };
  }
}
