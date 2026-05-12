"use client";
import { useState, useRef, useEffect, useCallback, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  chatEndpoint?: string;
  clearEndpoint?: string;
  placeholder?: string;
}

const BUBBLE = 56;
const PANEL_W = 320;
const PANEL_H = 480;

export default function FloatingChat({
  chatEndpoint = "/api/ai/chat",
  clearEndpoint = "/api/ai/history",
  placeholder = "Ask about leaves or support schedules.",
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPos({ x: window.innerWidth - BUBBLE - 24, y: window.innerHeight - BUBBLE - 24 });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      hasMoved.current = false;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    },
    [pos],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      hasMoved.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - BUBBLE, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - BUBBLE, e.clientY - dragOffset.current.y)),
      });
    }
    function onUp() {
      dragging.current = false;
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  function handleBubbleClick() {
    if (hasMoved.current) return;
    setOpen((o) => !o);
  }

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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: typeof err.detail === "string" ? err.detail : `Error (${res.status})` },
        ]);
        return;
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response ?? "No response." },
      ]);
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

  const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
  const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
  const panelLeft =
    pos.x + BUBBLE + 8 + PANEL_W > vw ? Math.max(0, pos.x - PANEL_W - 8) : pos.x;
  const panelTop =
    pos.y + BUBBLE + 8 + PANEL_H > vh ? Math.max(0, pos.y - PANEL_H - 8) : pos.y + BUBBLE + 8;

  return (
    <>
      {open && (
        <div
          data-testid="chat-panel"
          className="fixed flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: panelLeft,
            top: panelTop,
            width: PANEL_W,
            height: PANEL_H,
            background: "#1a2235",
            border: "1px solid #2d3a52",
            zIndex: 1000,
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-white text-sm font-semibold shrink-0"
            style={{ background: "linear-gradient(135deg, #1a3a6e, #2d5ca8)" }}
          >
            <span>AI Assistant</span>
            <button onClick={clearChat} className="text-xs opacity-80 hover:opacity-100 underline">
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 text-sm" style={{ background: "#1a2235" }}>
            {messages.length === 0 && (
              <p className="text-xs text-center mt-4" style={{ color: "#6b7a99" }}>{placeholder}</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                  style={m.role === "user" ? { background: "#2d5ca8", color: "#e2e8f0" } : { background: "#252d3f", color: "#e2e8f0" }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "#252d3f", color: "#6b7a99" }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} className="p-3 flex gap-2 shrink-0" style={{ borderTop: "1px solid #2d3a52" }}>
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
      )}

      <button
        data-testid="chat-bubble"
        onMouseDown={onMouseDown}
        onClick={handleBubbleClick}
        className="fixed flex items-center justify-center rounded-full shadow-lg text-white text-xl hover:opacity-90"
        style={{
          left: pos.x,
          top: pos.y,
          width: BUBBLE,
          height: BUBBLE,
          background: "linear-gradient(135deg, #2d5ca8, #F07A3F)",
          zIndex: 1001,
          cursor: "grab",
          userSelect: "none",
        }}
        aria-label="Toggle AI chat"
      >
        ✦
      </button>
    </>
  );
}
