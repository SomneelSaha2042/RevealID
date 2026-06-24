"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

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
    <div className="glass-card p-8 rounded-xl max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-2 rounded-lg text-primary">
          <ShieldCheck size={24} />
        </div>
        <h2 className="font-headline-md text-xl font-bold text-white">Issue Academic Credential</h2>
      </div>
      <form action={issueCredential} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="holderEmail" className="text-label-md font-bold text-xs uppercase text-on-surface-variant">Holder Email</label>
          <input
            id="holderEmail"
            name="holderEmail"
            type="email"
            required
            defaultValue="holder@example.edu"
            className="w-full bg-charcoal-depth border border-white/10 rounded-lg py-3 px-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="degree" className="text-label-md font-bold text-xs uppercase text-on-surface-variant">Degree</label>
          <input
            id="degree"
            name="degree"
            required
            maxLength={160}
            defaultValue="BSc Computer Science"
            className="w-full bg-charcoal-depth border border-white/10 rounded-lg py-3 px-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="graduationYear" className="text-label-md font-bold text-xs uppercase text-on-surface-variant">Graduation Year</label>
          <input
            id="graduationYear"
            name="graduationYear"
            type="number"
            min={1900}
            max={2200}
            required
            defaultValue={2026}
            className="w-full bg-charcoal-depth border border-white/10 rounded-lg py-3 px-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="cgpa" className="text-label-md font-bold text-xs uppercase text-on-surface-variant">CGPA</label>
            <input
              id="cgpa"
              name="cgpa"
              type="number"
              min={0}
              max={5}
              step="0.01"
              required
              defaultValue={4.72}
              className="w-full bg-charcoal-depth border border-white/10 rounded-lg py-3 px-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="marks" className="text-label-md font-bold text-xs uppercase text-on-surface-variant">Marks</label>
            <input
              id="marks"
              name="marks"
              type="number"
              min={0}
              max={10000}
              required
              defaultValue={9120}
              className="w-full bg-charcoal-depth border border-white/10 rounded-lg py-3 px-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>
        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row justify-end gap-4 mt-2">
          {message ? (
            <p className={`self-center text-sm font-bold mr-auto ${state === "success" ? "text-success-green bg-success-green/10 border border-success-green/20" : "text-error-red bg-error-red/10 border border-error-red/20"} px-4 py-2 rounded-lg`}>
              {message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={state === "submitting"}
            className="px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-label-md text-label-md shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {state === "submitting" ? "Issuing..." : "Issue credential"}
          </button>
        </div>
      </form>
    </div>
  );
}
