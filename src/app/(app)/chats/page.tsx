"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserMini = { id: string; name: string | null; username?: string | null; email: string };
type IndividualThread = { conversationId: string; user: UserMini; unreadCount: number };
type GroupThread = { conversationId: string; name: string; memberCount: number; unreadCount: number };
type ArenaThread = { id: string; name: string; unreadCount: number };
type Message = {
  id: string;
  body: string;
  shareUrl: string | null;
  createdAt: string;
  sender: UserMini;
};

export default function ChatsPage() {
  const [tab, setTab] = useState<"individuals" | "groups" | "arenas">("individuals");
  const [individuals, setIndividuals] = useState<IndividualThread[]>([]);
  const [groups, setGroups] = useState<GroupThread[]>([]);
  const [arenas, setArenas] = useState<ArenaThread[]>([]);
  const [following, setFollowing] = useState<UserMini[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [meId, setMeId] = useState("");

  async function loadThreads() {
    void (async () => {
      const [threadsRes, friendsRes, meRes] = await Promise.all([
        fetch("/api/chats/threads"),
        fetch("/api/friends"),
        fetch("/api/auth/me"),
      ]);
      if (threadsRes.ok) {
        const d = (await threadsRes.json()) as {
          individuals?: IndividualThread[];
          groups?: GroupThread[];
          arenas?: ArenaThread[];
        };
        setIndividuals(d.individuals ?? []);
        setGroups(d.groups ?? []);
        setArenas(d.arenas ?? []);
      }
      if (friendsRes.ok) {
        const f = (await friendsRes.json()) as { following?: UserMini[]; followers?: UserMini[] };
        const followerSet = new Set((f.followers ?? []).map((x) => x.id));
        setFollowing((f.following ?? []).filter((x) => followerSet.has(x.id)));
      }
      if (meRes.ok) {
        const me = (await meRes.json()) as { user?: { id: string } };
        setMeId(me.user?.id ?? "");
      }
    })();
  }

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    void (async () => {
      const r = await fetch(`/api/chats/conversations/${activeConversationId}`);
      if (!r.ok) return;
      const d = (await r.json()) as { messages?: Message[] };
      setMessages(d.messages ?? []);
      await loadThreads();
    })();
  }, [activeConversationId]);

  async function createConversation() {
    if (selectedUsers.length === 0) return;
    const r = await fetch("/api/chats/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: selectedUsers }),
    });
    if (!r.ok) return;
    const d = (await r.json()) as { conversationId: string };
    setPickerOpen(false);
    setSelectedUsers([]);
    setTab(selectedUsers.length > 1 ? "groups" : "individuals");
    setActiveConversationId(d.conversationId);
    await loadThreads();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConversationId || !draft.trim()) return;
    const r = await fetch(`/api/chats/conversations/${activeConversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() }),
    });
    if (!r.ok) return;
    setDraft("");
    const d = (await r.json()) as { message?: Message };
    setMessages((prev) => (d.message ? [...prev, d.message] : prev));
    await loadThreads();
  }

  return (
    <div className="min-w-0 space-y-4">
      <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-xl font-semibold text-transparent sm:text-2xl">Chats</h1>
      <div className="scrollbar-hide flex min-w-0 gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible sm:pb-0">
        <button type="button" onClick={() => setTab("individuals")} className={"shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm " + (tab === "individuals" ? "border border-cyan-400/40 bg-cyan-500/80 text-slate-950" : "border border-cyan-400/30 bg-cyan-500/10 text-cyan-100")}>Individuals</button>
        <button type="button" onClick={() => setTab("groups")} className={"shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm " + (tab === "groups" ? "border border-violet-400/40 bg-violet-500/80 text-slate-950" : "border border-violet-400/30 bg-violet-500/10 text-violet-100")}>Groups</button>
        <button type="button" onClick={() => setTab("arenas")} className={"shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm " + (tab === "arenas" ? "border border-sky-400/40 bg-sky-500/80 text-slate-950" : "border border-sky-400/30 bg-sky-500/10 text-sky-100")}>Arenas</button>
        {(tab === "individuals" || tab === "groups") && (
          <button type="button" onClick={() => setPickerOpen(true)} className="ml-auto shrink-0 whitespace-nowrap rounded-md border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-500/20">
            Chat +
          </button>
        )}
      </div>

      <div className="grid min-h-0 min-w-0 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-cyan-700/20">
          {tab === "individuals" && (
            <div className="space-y-2">
              {individuals.length === 0 ? <p className="text-sm text-(--muted)">No individual chats yet.</p> : null}
              {individuals.map((t) => (
                <button
                  key={t.conversationId}
                  type="button"
                  onClick={() => setActiveConversationId(t.conversationId)}
                  className="flex w-full items-center justify-between rounded-lg border border-(--card-border) px-3 py-2 text-left text-sm hover:bg-(--background)"
                >
                  <span>{t.user.name || t.user.username || t.user.email}</span>
                  {t.unreadCount > 0 ? <span className="rounded-full bg-(--accent) px-2 py-0.5 text-xs text-(--accent-foreground)">{t.unreadCount}</span> : null}
                </button>
              ))}
            </div>
          )}
          {tab === "groups" && (
            <div className="space-y-2">
              {groups.length === 0 ? <p className="text-sm text-(--muted)">No group chats yet.</p> : null}
              {groups.map((g) => (
                <button
                  key={g.conversationId}
                  type="button"
                  onClick={() => setActiveConversationId(g.conversationId)}
                  className="flex w-full items-center justify-between rounded-lg border border-(--card-border) px-3 py-2 text-left text-sm hover:bg-(--background)"
                >
                  <span>{g.name}</span>
                  {g.unreadCount > 0 ? <span className="rounded-full bg-(--accent) px-2 py-0.5 text-xs text-(--accent-foreground)">{g.unreadCount}</span> : null}
                </button>
              ))}
            </div>
          )}
          {tab === "arenas" && (
            <div className="space-y-2">
              {arenas.length === 0 ? <p className="text-sm text-(--muted)">No arena group chats yet.</p> : null}
              {arenas.map((a) => (
                <Link key={a.id} href={`/arena/${a.id}`} className="flex items-center justify-between rounded-lg border border-(--card-border) px-3 py-2 text-sm hover:bg-(--background)">
                  <span>{a.name}</span>
                  {a.unreadCount > 0 ? <span className="rounded-full bg-(--accent) px-2 py-0.5 text-xs text-(--accent-foreground)">{a.unreadCount}</span> : null}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex min-h-[min(50vh,360px)] min-w-0 flex-col rounded-2xl border border-violet-400/35 bg-gradient-to-br from-slate-900/90 to-indigo-900/65 p-4 shadow-lg shadow-violet-700/20 lg:min-h-0">
          {!activeConversationId ? (
            <p className="text-sm text-(--muted)">Select a chat thread to view messages.</p>
          ) : (
            <>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-2">
                {messages.map((m) => {
                  const mine = m.sender.id === meId;
                  return (
                    <div key={m.id} className={"flex " + (mine ? "justify-end pr-6" : "justify-start pl-6")}>
                      <div className={"max-w-[min(92%,18rem)] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%] " + (mine ? "border border-cyan-400/40 bg-cyan-500/80 text-slate-950" : "border border-violet-400/30 bg-black/20")}>
                        <p className="text-[10px] opacity-70">{m.sender.name || m.sender.username || m.sender.email}</p>
                        <p>{m.body}</p>
                        {m.shareUrl ? <a href={m.shareUrl} target="_blank" rel="noreferrer" className="text-xs underline">Open shared link</a> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendMessage} className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-md border border-violet-400/30 bg-slate-900/80 px-3 py-2 text-sm" placeholder="Send message..." />
                <button type="submit" className="min-h-11 shrink-0 rounded-md border border-cyan-400/40 bg-cyan-500/80 px-4 py-2 text-sm text-slate-950 hover:bg-cyan-400">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="scrollbar-hide max-h-[min(88dvh,520px)] w-full overflow-y-auto rounded-t-2xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg shadow-cyan-700/25 sm:max-w-lg sm:rounded-2xl sm:pb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">Start New Chat</p>
              <button type="button" onClick={() => setPickerOpen(false)} className="rounded border border-(--card-border) px-2 py-1 text-xs">Close</button>
            </div>
            <div className="max-h-[320px] space-y-1 overflow-y-auto">
              {following.length === 0 ? (
                <p className="py-6 text-center text-sm text-(--muted)">Sorry, you have no friends 😂</p>
              ) : (
                following.map((u) => {
                  const checked = selectedUsers.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 rounded border border-(--card-border) px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedUsers((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
                          )
                        }
                      />
                      <span>{u.name || u.username || u.email}</span>
                    </label>
                  );
                })
              )}
            </div>
            <button type="button" onClick={() => void createConversation()} className="mt-3 rounded-md bg-(--accent) px-3 py-2 text-sm text-(--accent-foreground)">
              Create Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
