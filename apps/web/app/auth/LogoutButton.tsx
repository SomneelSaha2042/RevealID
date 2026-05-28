"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const getCsrfToken = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("rid_csrf="))
    ?.split("=")[1];

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function logout() {
    setIsSubmitting(true);
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfToken() ?? "" }
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="text-button" disabled={isSubmitting} type="button" onClick={logout}>
      {isSubmitting ? "Signing out" : "Sign out"}
    </button>
  );
}
