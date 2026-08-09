"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, setUser } from "@/lib/auth";
import { redirectPathForRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in -> go straight to that role's dashboard.
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.replace(redirectPathForRole(user.role));
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError("Enter your email or employee ID");
      return;
    }

    setLoading(true);
    try {
      const payload = value.includes("@")
        ? { email: value }
        : { employeeId: value };

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      setUser({
        employeeId: data.employeeId,
        name: data.name,
        role: data.role,
      });

      router.replace(redirectPathForRole(data.role));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-xl w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-2 text-center">
          Dial n Dine HR System
        </h1>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Enter your email or employee ID to sign in
        </p>

        <input
          type="text"
          placeholder="Email or Employee ID"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-blue-500 outline-none mb-4"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 p-3 rounded font-semibold"
        >
          {loading ? "Signing in…" : "Login"}
        </button>

        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      </form>
    </div>
  );
}