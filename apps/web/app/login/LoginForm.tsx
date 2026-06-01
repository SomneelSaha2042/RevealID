"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Field, Input } from "../../components/ui/form";

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
    <Card>
      <CardContent>
        <form action={login} className="form-panel auth-form">
          <Field>
            Email
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field>
            Password
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Signing in..." : "Sign in"}
          </Button>
          {message ? <p className="form-message error">{message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
