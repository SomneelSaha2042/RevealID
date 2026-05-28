"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FormState = "idle" | "submitting" | "error";

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function login(formData: FormData) {
    setState("submitting");
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });

    if (!response.ok) {
      setState("error");
      setMessage("Sign in failed.");
      return;
    }

    const body = (await response.json()) as { user: { role: "HOLDER" | "ISSUER" } };
    router.push(body.user.role === "ISSUER" ? "/issuer/issue" : "/wallet");
    router.refresh();
  }

  return (
    <form action={login} className="form-panel auth-form">
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Password
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      <button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Signing in..." : "Sign in"}
      </button>
      {message ? <p className="form-message error">{message}</p> : null}
    </form>
  );
}
