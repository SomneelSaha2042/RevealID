import type { FastifyReply } from "fastify";

const cookiePath = "/";

type CookieOptions = {
  secure: boolean;
};

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
  options: CookieOptions
) {
  reply
    .setCookie("rid_access", tokens.accessToken, {
      httpOnly: true,
      secure: options.secure,
      sameSite: "lax",
      path: cookiePath,
      maxAge: 60 * 15
    })
    .setCookie("rid_refresh", tokens.refreshToken, {
      httpOnly: true,
      secure: options.secure,
      sameSite: "lax",
      path: cookiePath,
      maxAge: 60 * 60 * 24 * 30
    })
    .setCookie("rid_csrf", tokens.csrfToken, {
      httpOnly: false,
      secure: options.secure,
      sameSite: "lax",
      path: cookiePath,
      maxAge: 60 * 60 * 24 * 30
    });
}

export function clearAuthCookies(reply: FastifyReply, secure: boolean) {
  for (const name of ["rid_access", "rid_refresh", "rid_csrf"]) {
    reply.clearCookie(name, {
      path: cookiePath,
      secure,
      sameSite: "lax"
    });
  }
}
