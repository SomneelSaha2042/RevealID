import { cookies } from "next/headers";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "HOLDER" | "ISSUER";
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:4000"}/me`, {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() }
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { user?: AuthUser };
    return body.user ?? null;
  } catch {
    return null;
  }
}
