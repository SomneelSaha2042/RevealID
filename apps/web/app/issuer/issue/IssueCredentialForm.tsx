"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, Input } from "../../../components/ui/form";

type FormState = "idle" | "submitting" | "success" | "error";

const getCsrfToken = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("rid_csrf="))
    ?.split("=")[1];

export function IssueCredentialForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function issueCredential(formData: FormData) {
    setState("submitting");
    setMessage("");

    const response = await fetch("/api/credentials/issue", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": getCsrfToken() ?? ""
      },
      body: JSON.stringify({
        holderEmail: formData.get("holderEmail"),
        degree: formData.get("degree"),
        graduationYear: Number(formData.get("graduationYear")),
        cgpa: Number(formData.get("cgpa")),
        marks: Number(formData.get("marks"))
      })
    });

    if (!response.ok) {
      setState("error");
      setMessage(response.status === 403 ? "Issuer access is required." : "Credential could not be issued.");
      return;
    }

    setState("success");
    setMessage("Credential issued to holder wallet.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic credential</CardTitle>
        <CardDescription>Issued claims are signed as selectively disclosable SD-JWT fields.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={issueCredential} className="form-panel">
          <Field>
            Holder email
            <Input name="holderEmail" type="email" required defaultValue="holder@example.edu" />
          </Field>
          <Field>
            Degree
            <Input name="degree" required maxLength={160} defaultValue="BSc Computer Science" />
          </Field>
          <div className="form-grid">
            <Field>
              Graduation year
              <Input name="graduationYear" type="number" min={1900} max={2200} required defaultValue={2026} />
            </Field>
            <Field>
              CGPA
              <Input name="cgpa" type="number" min={0} max={5} step="0.01" required defaultValue={4.72} />
            </Field>
            <Field>
              Marks
              <Input name="marks" type="number" min={0} max={10000} required defaultValue={9120} />
            </Field>
          </div>
          <Button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Issuing..." : "Issue credential"}
          </Button>
          {message ? <p className={`form-message ${state}`}>{message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
