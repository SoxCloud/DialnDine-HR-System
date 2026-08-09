"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { getCurrentUser, setUser } from "@/lib/auth";
import { redirectPathForRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.replace(redirectPathForRole(user.role));
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
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
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <Card className="w-full max-w-md shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Dial n Dine HR System</h1>
            <p className="mt-1 text-sm text-gray-400">
              Sign in with your email and password
            </p>
          </div>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full py-3"
          >
            {loading ? "Signing in…" : "Login"}
          </Button>

          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
        </form>
      </Card>
    </div>
  );
}