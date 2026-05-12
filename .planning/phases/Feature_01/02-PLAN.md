---
phase: Feature_01
plan: "02"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/components/FloatingChat.tsx
  - frontend/app/calendar/page.tsx
  - frontend/app/admin/page.tsx
autonomous: true
requirements:
  - F1-AI-DRAG
  - F1-AI-TOGGLE
  - F1-AI-CLEAR
  - F1-AI-ADMIN
must_haves:
  truths:
    - "A draggable floating chat bubble appears on the calendar page"
    - "A draggable floating chat bubble appears on the admin page"
    - "The bubble can be repositioned anywhere on screen by dragging"
    - "Clicking the bubble icon opens the chat panel; clicking again closes it"
    - "A Clear button inside the open panel resets the conversation"
    - "The old AIPanel sidebar is removed from both pages"
  artifacts:
    - path: "frontend/components/FloatingChat.tsx"
      provides: "Self-contained draggable floating chat bubble with open/close and clear"
      contains: "onPointerDown"
    - path: "frontend/app/calendar/page.tsx"
      provides: "Calendar page using FloatingChat instead of AIPanel"
      contains: "FloatingChat"
    - path: "frontend/app/admin/page.tsx"
      provides: "Admin page using FloatingChat instead of AIPanel"
      contains: "FloatingChat"
  key_links:
    - from: "frontend/app/calendar/page.tsx"
      to: "frontend/components/FloatingChat.tsx"
      via: "import FloatingChat"
      pattern: "import FloatingChat"
    - from: "frontend/app/admin/page.tsx"
      to: "frontend/components/FloatingChat.tsx"
      via: "import FloatingChat"
      pattern: "import FloatingChat"
---

<objective>
Replace the fixed AIPanel sidebar with a draggable floating chat bubble component on both the
calendar page and the admin page.

Purpose: Users should be able to move the AI chat out of the way while viewing the calendar.
The chat must open/close and have a clear/reset action.

Output: New FloatingChat.tsx component. Updated calendar/page.tsx and admin/page.tsx that import
FloatingChat instead of AIPanel and remove the old sidebar layout.
</objective>

<execution_context>
@E:/AI Playground/Projects/claude_teamSchedule/frontend/components/AIPanel.tsx
</execution_context>

<context>
@E:/AI Playground/Projects/claude_teamSchedule/frontend/components/AIPanel.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/app/calendar/page.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/app/admin/page.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/lib/api.ts

<interfaces>
From frontend/lib/api.ts:
```typescript
export async function apiFetch(path: string, init?: RequestInit): Promise<Response>
// Reads JWT from localStorage, attaches Authorization: Bearer header
// Redirects to /login on 401
```

From frontend/components/AIPanel.tsx (existing interface to replicate):
```typescript
interface AIPanelProps {
  chatEndpoint?: string;     // default "/api/ai/chat"
  clearEndpoint?: string;    // default "/api/ai/history"
  fullWidth?: boolean;       // unused in FloatingChat
  placeholder?: string;
}

// Internal message shape:
interface Message {
  role: "user" | "assistant";
  content: string;
}

// sendMessage: POST {chatEndpoint} with body { message: string }, reads response.response
// clearChat:  DELETE {clearEndpoint}, clears local messages state
```

Project color palette:
- Background dark: #1a2235, #252d3f
- Accent blue: #2d5ca8, #4A78C2, #5F8FD6
- Accent orange: #F07A3F, #E0642F
- Text: #e2e8f0, #a0aec0, #6b7a99
- Border: #2d3a52
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create FloatingChat component</name>
  <files>frontend/components/FloatingChat.tsx</files>
  <read_first>
    - frontend/components/AIPanel.tsx — copy the sendMessage and clearChat logic exactly; do not rewrite from scratch
    - frontend/lib/api.ts — confirm apiFetch signature
  </read_first>
  <action>
Create `frontend/components/FloatingChat.tsx`. This is a "use client" component.

The component props are identical to AIPanel (minus fullWidth):
```typescript
interface Props {
  chatEndpoint?: string;
  clearEndpoint?: string;
  placeholder?: string;
}
```
Defaults: chatEndpoint="/api/ai/chat", clearEndpoint="/api/ai/history", placeholder="Ask about leaves or support schedules."

State:
- `open: boolean` — false initially; toggles the chat panel visibility
- `pos: { x: number; y: number }` — initialized to `{ x: 0, y: 0 }`; set in useEffect to `{ x: window.innerWidth - 80, y: window.innerHeight - 80 }`
- `messages: Message[]`, `input: string`, `loading: boolean` — same as AIPanel
- `dragging: useRef<boolean>(false)` — NOT state; ref to avoid re-renders
- `offset: useRef<{ x: number; y: number }>({ x: 0, y: 0 })`

Drag handlers (attach to the bubble container div):
```typescript
function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
  // Only start drag on the bubble itself, not on child buttons/inputs
  if ((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).tagName === "INPUT") return;
  dragging.current = true;
  offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  e.currentTarget.setPointerCapture(e.pointerId);
}
function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
  if (!dragging.current) return;
  setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
}
function onPointerUp() { dragging.current = false; }
```

sendMessage: copy exactly from AIPanel.tsx (POST to chatEndpoint, read data.response).
clearChat: copy exactly from AIPanel.tsx (DELETE clearEndpoint, setMessages([])).

useEffect for auto-scroll (copy from AIPanel):
```typescript
const bottomRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

Rendering structure:
```
<div  // outer container — position:fixed, draggable
  style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000 }}
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={onPointerUp}
>
  {/* Toggle button — always visible */}
  <button
    onClick={() => setOpen(o => !o)}
    style={{
      width: 52, height: 52, borderRadius: "50%",
      background: "linear-gradient(135deg, #2d5ca8, #F07A3F)",
      color: "white", border: "none", cursor: "pointer",
      fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
    }}
    title={open ? "Close chat" : "Open AI chat"}
  >
    {open ? "x" : "AI"}
  </button>

  {/* Chat panel — shown only when open */}
  {open && (
    <div
      style={{
        position: "absolute", bottom: 64, right: 0,
        width: 320, background: "#1a2235",
        border: "1px solid #2d3a52", borderRadius: 12,
        display: "flex", flexDirection: "column",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        maxHeight: "60vh"
      }}
    >
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a3a6e, #2d5ca8)", borderRadius: "12px 12px 0 0", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "white", fontWeight: 600, fontSize: 13 }}>AI Assistant</span>
        <button onClick={clearChat} style={{ color: "white", fontSize: 11, opacity: 0.8, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Clear
        </button>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <p style={{ color: "#6b7a99", fontSize: 11, textAlign: "center", marginTop: 12 }}>{placeholder}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "90%", borderRadius: 10, padding: "6px 10px", fontSize: 11, lineHeight: 1.5,
              background: m.role === "user" ? "#2d5ca8" : "#252d3f",
              color: "#e2e8f0"
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#252d3f", color: "#6b7a99", borderRadius: 10, padding: "6px 10px", fontSize: 11 }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input form */}
      <form onSubmit={sendMessage} style={{ padding: "8px 10px", borderTop: "1px solid #2d3a52", display: "flex", gap: 6 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          style={{ flex: 1, background: "#252d3f", border: "1px solid #2d3a52", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: 11, outline: "none" }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{ background: "#F07A3F", color: "white", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}
        >
          Send
        </button>
      </form>
    </div>
  )}
</div>
```

IMPORTANT — no emojis per AGENTS.md: The toggle button label when closed is "AI". When open it is "x".
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && grep -c "onPointerDown" frontend/components/FloatingChat.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists at frontend/components/FloatingChat.tsx
    - Contains `"use client"` directive at line 1
    - Contains `onPointerDown`, `onPointerMove`, `onPointerUp` handlers
    - Contains `useEffect` that sets `pos` from `window.innerWidth` and `window.innerHeight`
    - Contains `position: "fixed"` in the outer container style
    - Contains `zIndex: 1000` (or higher) in the outer container style
    - Contains `sendMessage` function that POSTs to chatEndpoint
    - Contains `clearChat` function that calls DELETE on clearEndpoint
    - Does NOT use any emoji characters
    - Toggle button uses text "AI" when closed, "x" when open
  </acceptance_criteria>
  <done>FloatingChat.tsx exists, is draggable via pointer events, toggles open/close, and has a working Clear button.</done>
</task>

<task type="auto">
  <name>Task 2: Replace AIPanel with FloatingChat in both pages</name>
  <files>frontend/app/calendar/page.tsx, frontend/app/admin/page.tsx</files>
  <read_first>
    - frontend/app/calendar/page.tsx — read full file before editing
    - frontend/app/admin/page.tsx — read full file before editing
    - frontend/components/FloatingChat.tsx — read to confirm export name
  </read_first>
  <action>
CALENDAR PAGE (frontend/app/calendar/page.tsx):

1. Remove: `import AIPanel from "@/components/AIPanel";`
2. Add: `import FloatingChat from "@/components/FloatingChat";`
3. In the JSX, remove `<AIPanel />` — it is inside the `<div className="flex flex-1 overflow-hidden">` alongside the Calendar scroll area.
4. Remove the sidebar container that wraps AIPanel (the `<div className="flex flex-1 overflow-hidden">` currently uses flex to show calendar + AIPanel side by side). Change the layout so the calendar takes full width:
   - The outer `<div className="flex flex-1 overflow-hidden">` stays but the Calendar gets `flex-1`.
   - Remove the AIPanel entirely from this div.
5. Add `<FloatingChat />` as a direct child of the outermost page div (the `<div className="flex flex-col h-screen">`), placed after the closing of the main content div. FloatingChat is position:fixed so it does not affect layout.

Final structure inside the page return:
```tsx
<div className="flex flex-col h-screen" style={{ background: "#1e2433" }}>
  {/* Header */}
  ...
  {/* Gradient bar */}
  ...
  {/* Legend */}
  ...
  {/* Main content — calendar only, full width */}
  <div className="flex-1 overflow-auto">
    <Calendar ... />
  </div>
  {/* Floating chat — position:fixed, no layout impact */}
  <FloatingChat />
</div>
```

ADMIN PAGE (frontend/app/admin/page.tsx):

1. Remove: `import AIPanel from "@/components/AIPanel";`
2. Add: `import FloatingChat from "@/components/FloatingChat";`
3. The admin page has a flex layout `<div className="flex-1 overflow-hidden flex">` with a left content area and AIPanel as the right sidebar. Remove AIPanel from this div.
4. The left content div (currently `<div className="flex-1 overflow-hidden flex flex-col">`) should remain and take full width (it already has flex-1 so removing AIPanel achieves this automatically).
5. Add `<FloatingChat chatEndpoint="/api/ai/admin-chat" clearEndpoint="/api/ai/admin-history" placeholder="Ask about leaves, schedules, or CSV file format." />` as a direct child of the outermost page div (`<div className="flex flex-col h-screen">`), placed just before the closing tag.

Do NOT remove the Modal component or any other admin functionality.
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && grep -c "FloatingChat" frontend/app/calendar/page.tsx && grep -c "FloatingChat" frontend/app/admin/page.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep "AIPanel" frontend/app/calendar/page.tsx` returns no matches
    - `grep "AIPanel" frontend/app/admin/page.tsx` returns no matches
    - `grep "FloatingChat" frontend/app/calendar/page.tsx` returns at least 2 matches (import + usage)
    - `grep "FloatingChat" frontend/app/admin/page.tsx` returns at least 2 matches (import + usage)
    - Admin page FloatingChat has props: `chatEndpoint="/api/ai/admin-chat"` and `clearEndpoint="/api/ai/admin-history"`
    - Calendar page FloatingChat has no custom props (uses defaults)
    - Neither page imports AIPanel any longer
  </acceptance_criteria>
  <done>Both pages import and render FloatingChat; AIPanel is removed from both pages; layout updated to full-width calendar.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user -> FloatingChat -> /api/ai/chat | JWT attached by apiFetch; same surface as existing AIPanel |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-F1-02-01 | Information Disclosure | FloatingChat position in localStorage | accept | Position is not persisted; resets on reload; no sensitive data |
| T-F1-02-02 | Tampering | Client-side drag position | accept | Position is cosmetic only; no server-side effect |
</threat_model>

<verification>
After both tasks:
1. `grep "AIPanel" frontend/app/calendar/page.tsx` — must return empty (no matches)
2. `grep "AIPanel" frontend/app/admin/page.tsx` — must return empty (no matches)
3. `grep "FloatingChat" frontend/app/calendar/page.tsx` — at least 2 lines
4. `grep "FloatingChat" frontend/app/admin/page.tsx` — at least 2 lines
5. `grep "onPointerDown" frontend/components/FloatingChat.tsx` — returns a match
6. `grep "position.*fixed" frontend/components/FloatingChat.tsx` — returns a match
</verification>

<success_criteria>
- FloatingChat.tsx exists with drag, open/close, and clear functionality
- Both pages render FloatingChat instead of AIPanel
- The chat bubble is draggable (pointer events implemented)
- The chat panel opens when the bubble is clicked, closes on second click
- The Clear button resets conversation history
- No emoji characters in the component
</success_criteria>

<output>
After completion, create `.planning/phases/Feature_01/Feature_01-02-SUMMARY.md` with:
- FloatingChat component location and props interface
- How drag is implemented (pointer events, useRef for dragging flag)
- How both pages wire to FloatingChat (props used for admin)
- Confirmation that AIPanel is no longer imported/used
</output>
