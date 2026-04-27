"use client";
import { useState, useRef, useEffect, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIPanelProps {
  chatEndpoint?: string;
  clearEndpoint?: string;
  fullWidth?: boolean;
  placeholder?: string;
}

export default function AIPanel({
  chatEndpoint = "/api/ai/chat",
  clearEndpoint = "/api/ai/history",
  fullWidth = false,
  placeholder = "Ask about leaves or support schedules.",
}: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch(chatEndpoint, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = typeof err.detail === "string" ? err.detail : `Error (${res.status})`;
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
        return;
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response ?? "No response." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error contacting AI." }]);
    } finally {
      setLoading(false);
    }
  }

  async function clearChat() {
    await apiFetch(clearEndpoint, { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div
      className="flex flex-col h-full"
      style={fullWidth ? {} : { width: 320, minWidth: 280, borderLeft: "1px solid #2d3a52" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white text-sm font-semibold shrink-0"
        style={{ background: "linear-gradient(135deg, #1a3a6e, #2d5ca8)" }}
      >
        <span>AI Assistant</span>
        <button onClick={clearChat} className="text-xs opacity-80 hover:opacity-100 underline">
          Clear
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 text-sm"
        style={{ background: "#1a2235" }}
      >
        {messages.length === 0 && (
          <p className="text-xs text-center mt-4" style={{ color: "#6b7a99" }}>{placeholder}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "#2d5ca8", color: "#e2e8f0" }
                  : { background: "#252d3f", color: "#e2e8f0" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-xl px-3 py-2 text-xs"
              style={{ background: "#252d3f", color: "#6b7a99" }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="p-3 flex gap-2 shrink-0"
        style={{ borderTop: "1px solid #2d3a52" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          style={{ background: "#252d3f", border: "1px solid #2d3a52", color: "#e2e8f0" }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-80"
          style={{ background: "#F07A3F" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
