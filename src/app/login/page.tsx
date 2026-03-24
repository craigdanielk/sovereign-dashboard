"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } else {
      setError("ACCESS DENIED");
      setPassword("");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="border border-zinc-800 p-8 w-full max-w-sm">
        <div className="text-green-500 text-xs tracking-widest mb-1 font-mono">
          SOVEREIGN // WAR ROOM
        </div>
        <div className="text-zinc-600 text-xs tracking-wider mb-8 font-mono">
          RESTRICTED ACCESS
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-zinc-500 text-xs tracking-widest mb-2 font-mono">
              ACCESS CODE
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-green-400 text-sm px-3 py-2 font-mono focus:outline-none focus:border-green-700 placeholder-zinc-700"
              placeholder="••••••••"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs tracking-widest font-mono">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full border border-zinc-700 text-zinc-400 text-xs py-2.5 tracking-widest font-mono hover:border-green-700 hover:text-green-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
