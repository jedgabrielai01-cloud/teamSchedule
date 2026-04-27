"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }
      const { token } = await res.json();
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);
      router.push(username === "Admin" ? "/admin" : "/calendar");
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#1e2433" }}
    >
      <div
        className="rounded-2xl shadow-xl p-10 w-full max-w-sm border"
        style={{ background: "#252d3f", borderColor: "#2d3a52" }}
      >
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "#93b8f5" }}>
          Team Schedule
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: "#6b7a99" }}>Sign in to continue</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#a0aec0" }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#a0aec0" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
              placeholder="Password"
            />
          </div>

          {error && <p className="text-sm" style={{ color: "#f0a070" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60 hover:opacity-80"
            style={{ background: "linear-gradient(90deg, #F07A3F, #E0642F)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div
          className="mt-6 h-0.5 rounded"
          style={{ background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }}
        />
      </div>
    </div>
  );
}
