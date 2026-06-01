"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Field, Input } from "../../components/ui/form";

type FormState = "idle" | "submitting" | "error";

export function RegisterForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function register(formData: FormData) {
    setState("submitting");
    setMessage("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        name: formData.get("name")
      })
    });

    if (!response.ok) {
      setState("error");
      setMessage(response.status === 409 ? "Email is already registered." : "Registration failed.");
      return;
    }

    router.push("/wallet");
    router.refresh();
  }

  return (
    <Card>
      <CardContent>
        <form action={register} className="form-panel auth-form">
          <Field>
            Name
            <Input name="name" required maxLength={120} autoComplete="name" />
          </Field>
          <Field>
            Email
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field>
            Password
            <Input name="password" type="password" required minLength={12} autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Creating account..." : "Create holder account"}
          </Button>
          {message ? <p className="form-message error">{message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
