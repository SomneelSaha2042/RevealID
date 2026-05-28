"use client";

import { useState } from "react";

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
    <form action={issueCredential} className="form-panel">
      <label>
        Holder email
        <input name="holderEmail" type="email" required placeholder="holder@example.edu" />
      </label>
      <label>
        Degree
        <input name="degree" required maxLength={160} placeholder="BSc Computer Science" />
      </label>
      <div className="form-grid">
        <label>
          Graduation year
          <input name="graduationYear" type="number" min={1900} max={2200} required placeholder="2026" />
        </label>
        <label>
          CGPA
          <input name="cgpa" type="number" min={0} max={5} step="0.01" required placeholder="3.90" />
        </label>
        <label>
          Marks
          <input name="marks" type="number" min={0} max={10000} required placeholder="875" />
        </label>
      </div>
      <button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Issuing..." : "Issue credential"}
      </button>
      {message ? <p className={`form-message ${state}`}>{message}</p> : null}
    </form>
  );
}
