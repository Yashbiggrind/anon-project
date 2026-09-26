"use client";
import "./anon.css";
import { useEffect, useRef, useState, useCallback, startTransition } from "react"
import { createPortal } from "react-dom";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { LANGUAGES, Lang, translate as libTranslate, isRTL } from "@/lib/i18n";
import { playSound, unlockAudio, setMuted } from "@/lib/sounds";
import { ensureSessionStart, bumpSent, bumpSeen } from "@/lib/sessionStats";
import { tickFootprint, computeStats, FootprintStats, formatCountdown } from "@/lib/footprint";
import { enqueue, list as listQueue, remove as removeQueue, QueuedMessage } from "@/lib/offlineQueue";
import {
  saveMessage as persistSave,
  loadMessages as persistLoad,
  updateMessage as persistUpdate,
  removeMessage as persistRemove,
  clearScope as persistClearScope,
} from "@/lib/messageStore";
import {
  LS_USERNAME,
  LS_LAST_OFFER,
  LS_PENDING,
  LS_LANG,
  LS_MUTED,
  LS_LAST_SEEN_PUBLIC,
  SEVEN_DAYS,
  ONE_DAY,
  EXTRA,
  REACTION_EMOJIS,
  EMOJI_PICKER,
  SPARKS,
  doors,
} from "@/lib/anonConstants";
import { serverUrl, makeRandomName } from "@/lib/anonUtils";

type Section = "chat" | "private" | "content";
type Identity = { sessionId: string; username: string; accent: string; status?: string };
type ChatMessage = {
  id: string;
  senderSessionId: string;
  senderName: string;
  content: string;
  createdAt: number;
  editedAt?: number;
  deleted?: boolean;
  image?: string;
  localSent?: boolean;
  replyTo?: { id: string; senderName: string; content: string };
};
type OnlineUser = { sessionId: string; username: string; accent: string; status: string };
type Invite = { inviteId: string; from: { sessionId: string; username: string }; capacity: number; occupancy: number };
type RoomParticipant = {
  sessionId: string;
  username: string;
  isAdmin: boolean;
  isHost: boolean;
  timedOutUntil: number;
};
type PrivateRoom = {
  roomId: string;
  host: string;
  admin: string;
  topic: string;
  capacity: number;
  slowMode: number;
  participants: RoomParticipant[];
  status: string;
};
type BlockedUser = { sessionId: string; username: string };
type RoomSystemLine = {
  id: string;
  type: string;
  username?: string;
  by?: string;
  to?: string;
  from?: string;
  topic?: string;
  seconds?: number;
  durationMs?: number;
  at: number;
};

/* v20.7 — DM */
type DMMessage = {
  id: string;
  threadId: string;
  senderSessionId: string;
  senderName: string;
  content: string;
  createdAt: number;
  mine: boolean;
};
type DMPanel = {
  target: { sessionId: string; username: string };
  threadId?: string;
  loading?: boolean;
};

/* v18 — distance from bottom (px) that still counts as "at the bottom" */
const NEAR_BOTTOM_PX = 100;

export default function Home() {
  const [section, setSection] = useState<Section | null>(null);
  const [opening, setOpening] = useState<Section | null>(null);
  const [flash, setFlash] = useState(false);
  const [gone, setGone] = useState(false);

  const [lang, setLang] = useState<Lang>("en");
  const [langOpen, setLangOpen] = useState(false);
  const [muted, setMutedState] = useState(false);

  const selfRef = useRef<string | null>(null);

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [connected, setConnected] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [online, setOnline] = useState<OnlineUser[]>([]);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [room, setRoom] = useState<PrivateRoom | null>(null);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const privateInputRef = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCapacity, setCreateCapacity] = useState(5);
  const [createTopic, setCreateTopic] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteManual, setInviteManual] = useState("");
  const [reportOpen, setReportOpen] = useState<{ sessionId: string; username: string } | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);

  /* v20.5 — member list + admin actions */
  const [memberListOpen, setMemberListOpen] = useState(true);
  const [memberMenuFor, setMemberMenuFor] = useState<string | null>(null);
  const [roomSystemLines, setRoomSystemLines] = useState<RoomSystemLine[]>([]);
    /* v20.8 — topic editor + slow mode UI */
  const [topicEditing, setTopicEditing] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* v20.8 — room discovery */
  const [roomList, setRoomList] = useState<Array<{
    roomId: string; topic: string; adminName: string;
    capacity: number; occupancy: number; full: boolean;
    slowMode: number; createdAt: number;
  }>>([]);
  const [roomListLoading, setRoomListLoading] = useState(false);

  /* v20.7 — DM state */
  const [dmPanel, setDmPanel] = useState<DMPanel | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [dmTypingFrom, setDmTypingFrom] = useState<{ username: string; at: number } | null>(null);
  const dmInputRef = useRef<HTMLInputElement>(null);
  const dmMsgsRef = useRef<HTMLDivElement>(null);
  const dmLastTypingRef = useRef(0);

  const [toast, setToast] = useState<string | null>(null);
  const [nameOffer, setNameOffer] = useState<{ a: string; b: string } | null>(null);
  const [typingPublic, setTypingPublic] = useState<Record<string, { username: string; at: number }>>({});
  const [typingRoom, setTypingRoom] = useState<Record<string, { username: string; at: number }>>({});
  const [systemLines, setSystemLines] = useState<
    { id: string; type: string; username?: string; oldName?: string; at: number }[]
  >([]);
  const [openTime, setOpenTime] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [messageMenuFor, setMessageMenuFor] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<string>("Smileys");

  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageTarget, setImageTarget] = useState<"public" | "room">("public");

  const [fp, setFp] = useState<FootprintStats | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [queued, setQueued] = useState<QueuedMessage[]>([]);
  const [missed, setMissed] = useState<ChatMessage[]>([]);
  const [welcomeBack, setWelcomeBack] = useState<{ awayFor: number; count: number } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const privMsgsRef = useRef<HTMLDivElement>(null);
  const lastTypingRef = useRef(0);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [langMenuPos, setLangMenuPos] = useState<{ top: number; right: number } | null>(null);
  /* ==================================================================
     v18 — Scroll-to-bottom arrow (Instagram-style)
     ================================================================== */
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [scrollBadge, setScrollBadge] = useState(0);
  const [showPrivateScrollBtn, setShowPrivateScrollBtn] = useState(false);
  const [privateScrollBadge, setPrivateScrollBadge] = useState(0);

  const pubScrollingRef = useRef(false);
  const privScrollingRef = useRef(false);
  const pubPrevLenRef = useRef(0);
  const privPrevLenRef = useRef(0);
  const pubInitRef = useRef(false);
  const privInitRef = useRef(false);
  /* ==================================================================
     v16 — Stable callbacks. CRITICAL for MessageBubble's memo to work.
     ================================================================== */

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const pack = EXTRA[key];
    const local = pack?.[lang] ?? pack?.en;
    if (local !== undefined) {
      if (!vars) return local;
      return local.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
    }
    return libTranslate(lang, key, vars);
  }, [lang]);

  const timeShort = useCallback((ts: number): string => {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 5) return t("justNow");
    if (d < 60) return t("sAgo", { n: d });
    if (d < 3600) return t("mAgo", { n: Math.floor(d / 60) });
    if (d < 86400) return t("hAgo", { n: Math.floor(d / 3600) });
    if (d < 172800) return t("yesterday");
    if (d < 604800) return t("dAgo", { n: Math.floor(d / 86400) });
    if (d < 2592000) return t("wAgo", { n: Math.floor(d / 604800) });
    if (d < 31536000) return t("moAgo", { n: Math.floor(d / 2592000) });
    return t("yAgo", { n: Math.floor(d / 31536000) });
  }, [t]);

  const timeFull = useCallback((ts: number): string => {
    return new Date(ts).toLocaleString(lang, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }, [lang]);

  const toggleTime = useCallback((id: string) => {
    setOpenTime((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const showToast = useCallback((msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_LANG, lang);
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMute = localStorage.getItem(LS_MUTED) === "1";
    setMutedState(savedMute);
    setMuted(savedMute);
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setMuted(next);
      localStorage.setItem(LS_MUTED, next ? "1" : "0");
      return next;
    });
  }, []);

  useEffect(() => {
    ensureSessionStart();
    const update = () => {
      const next = computeStats(tickFootprint());
      setFp((prev) => {
        if (prev && Math.abs(prev.pctDeleted - next.pctDeleted) < 0.5) return prev;
        return next;
      });
    };
    update();
    const tmr = setInterval(update, 4000);
    return () => clearInterval(tmr);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => { setQueued(listQueue()); }, []);

  useEffect(() => {
    if (!connected && typeof window !== "undefined") {
      localStorage.setItem(LS_LAST_SEEN_PUBLIC, String(Date.now()));
    }
  }, [connected]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLang = localStorage.getItem(LS_LANG) as Lang | null;
    if (savedLang && LANGUAGES.some((l) => l.code === savedLang)) setLang(savedLang);

    const now = Date.now();
    const savedName = localStorage.getItem(LS_USERNAME) || "";
    const rawLastOffer = localStorage.getItem(LS_LAST_OFFER);

    let lastOffer: number;
    if (rawLastOffer === null) {
      lastOffer = now;
      localStorage.setItem(LS_LAST_OFFER, String(now));
    } else {
      const parsed = parseInt(rawLastOffer, 10);
      lastOffer = Number.isFinite(parsed) ? parsed : now;
    }

    let pending: { a: string; b: string; shownAt: number } | null = null;
    try {
      const raw = localStorage.getItem(LS_PENDING);
      if (raw) pending = JSON.parse(raw);
    } catch { /* ignore */ }

    if (pending && now - pending.shownAt > ONE_DAY) {
      localStorage.setItem(LS_LAST_OFFER, String(now));
      localStorage.removeItem(LS_PENDING);
      pending = null;
    }
    if (now - lastOffer >= SEVEN_DAYS) {
      if (!pending) {
        pending = { a: makeRandomName(), b: makeRandomName(), shownAt: now };
        localStorage.setItem(LS_PENDING, JSON.stringify(pending));
      }
      setNameOffer({ a: pending.a, b: pending.b });
    }

    const socket = io(serverUrl(), {
      auth: savedName ? { username: savedName } : {},
      transports: ["websocket", "polling"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setIsOffline(false);
      socket.emit("blocked:list", {}, (res: any) => {
        if (res?.ok) setBlockedList(res.blocked);
      });
      const sinceRaw = localStorage.getItem(LS_LAST_SEEN_PUBLIC);
      const since = sinceRaw ? parseInt(sinceRaw, 10) : 0;
      if (Number.isFinite(since) && since > 0) {
        socket.emit("messages:since", { since }, (res: any) => {
          if (res?.ok && Array.isArray(res.messages) && res.messages.length > 0) {
            setMissed(res.messages);
            setWelcomeBack({ awayFor: res.awayFor || 0, count: res.messages.length });
          }
        });
      }
      const pendingMsgs = listQueue();
      if (pendingMsgs.length > 0) {
        let i = 0;
        const sendNext = () => {
          if (i >= pendingMsgs.length) { setQueued([]); return; }
          const m = pendingMsgs[i];
          socket.emit("chat:public:send", { content: m.content }, (ack: any) => {
            if (ack?.ok) removeQueue(m.id);
            i++;
            sendNext();
          });
        };
        sendNext();
      }
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("session:ready", (s: Identity) => {
      selfRef.current = s.sessionId;
      setIdentity(s);
      if (s.username) localStorage.setItem(LS_USERNAME, s.username);
    });
    socket.on("online:list", (l: OnlineUser[]) => setOnline(l));

    socket.on("chat:public:message", (m: ChatMessage) => {
      const isMine = m.senderSessionId === selfRef.current;
      if (!isMine) { playSound("message"); bumpSeen(); }
      startTransition(() => setMessages((p) => {
        if (p.some((x) => x.id === m.id)) return p;
        if (isMine) {
          const tempIdx = p.findIndex(
            (x) => x.id.startsWith("temp-") && x.content === m.content && Math.abs(x.createdAt - m.createdAt) < 10000
          );
          if (tempIdx >= 0) {
            const next = [...p];
            next[tempIdx] = { ...m, localSent: true };
            return next;
          }
        }
        return [...p.slice(-499), { ...m, localSent: isMine }];
      }));
      localStorage.setItem(LS_LAST_SEEN_PUBLIC, String(Date.now()));
      persistSave({ ...m, localSent: isMine, scope: "public" });
    });

    socket.on("system:public", (s: { type: string; username?: string; oldName?: string }) => {
      setSystemLines((p) => [
        ...p.slice(-9),
        { id: Math.random().toString(36).slice(2), type: s.type, username: s.username, oldName: s.oldName, at: Date.now() },
      ]);
    });

    socket.on("typing:public", (tt) => setTypingPublic((p) => ({ ...p, [tt.sessionId]: { username: tt.username, at: Date.now() } })));
    socket.on("typing:room", (tt) => setTypingRoom((p) => ({ ...p, [tt.sessionId]: { username: tt.username, at: Date.now() } })));

    socket.on("reaction:update", ({ messageId, reactions: rxs }: { messageId: string; reactions: { emoji: string; count: number; mine: boolean }[] }) => {
      setReactions((p) => ({ ...p, [messageId]: rxs }));
    });

    socket.on("message:edited", ({ messageId, content, editedAt }: { messageId: string; content: string; editedAt: number }) => {
      setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m)));
      setPrivateMessages((p) => p.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m)));
    });

    socket.on("message:deleted", ({ messageId }: { messageId: string }) => {
      setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, deleted: true, content: "" } : m)));
      setPrivateMessages((p) => p.map((m) => (m.id === messageId ? { ...m, deleted: true, content: "" } : m)));
    });

    socket.on("invite:received", (inv: Invite) => {
      playSound("invite");
      setInvites((p) => [...p, inv]);
      showToast(libTranslate(lang, "invitationReceived", { name: inv.from.username, cap: inv.capacity }), 3000);
    });
    socket.on("invite:declined", () => showToast(libTranslate(lang, "invitationDeclined")));

    socket.on("room:update", (r: PrivateRoom) => { setRoom(r); setSection("private"); });

    socket.on("room:system", (p: any) => {
      setRoomSystemLines((prev) => [
        ...prev.slice(-9),
        { id: Math.random().toString(36).slice(2), ...p, at: p.at || Date.now() },
      ]);
    });

    socket.on("room:kicked", (p: { roomId: string; by: string }) => {
      showToast(`You were removed from the room by ${p.by}.`, 3000);
      setRoom(null);
      setPrivateMessages([]);
      setRoomSystemLines([]);
      setMemberMenuFor(null);
    });

    socket.on("room:message", (m: ChatMessage) => {
      const isMine = m.senderSessionId === selfRef.current;
      if (!isMine) { playSound("message"); bumpSeen(); }
      startTransition(() => setPrivateMessages((p) => {
        if (p.some((x) => x.id === m.id)) return p;
        if (isMine) {
          const tempIdx = p.findIndex(
            (x) => x.id.startsWith("temp-") && x.content === m.content && Math.abs(x.createdAt - m.createdAt) < 10000
          );
          if (tempIdx >= 0) {
            const next = [...p];
            next[tempIdx] = { ...m, localSent: true };
            return next;
          }
        }
        return [...p.slice(-499), { ...m, localSent: isMine }];
      }));
      if (room) persistSave({ ...m, localSent: isMine, scope: "room", roomId: room.roomId });
    });

    socket.on("room:ended", (e: { reason: string }) => {
      if (room) persistClearScope("room", room.roomId);
      setRoom(null); setPrivateMessages([]); setInviteOpen(false);
      setRoomSystemLines([]);
      setMemberMenuFor(null);
      const key = e.reason?.toLowerCase().includes("disconnect") ? "roomEndedDisconnected" : "roomEndedLeft";
      showToast(libTranslate(lang, key), 3000);
    });

    /* v20.7 — DM listeners */
    socket.on("dm:message", (m: DMMessage) => {
      if (!m.mine) { playSound("message"); bumpSeen(); }
      setDmPanel((p) => {
        if (p?.threadId === m.threadId) {
          setDmMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          return p;
        }
        if (!m.mine) showToast(`DM from ${m.senderName}`, 2500);
        return p;
      });
    });

    socket.on("dm:typing", (p: { threadId: string; sessionId: string; username: string }) => {
      setDmPanel((cur) => {
        if (cur?.threadId === p.threadId) {
          setDmTypingFrom({ username: p.username, at: Date.now() });
        }
        return cur;
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const [pub, roomMsgs] = await Promise.all([
          persistLoad("public"),
          room ? persistLoad("room", room.roomId) : Promise.resolve([]),
        ]);
        if (pub.length > 0) {
          startTransition(() => setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of pub) if (!seen.has(m.id)) merged.push(m as any);
            return merged.slice(-500);
          }));
        }
        if (roomMsgs.length > 0) {
          startTransition(() => setPrivateMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of roomMsgs) if (!seen.has(m.id)) merged.push(m as any);
            return merged.slice(-500);
          }));
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roomId]);

  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;

    const prevLen = pubPrevLenRef.current;
    const curLen = messages.length;
    pubPrevLenRef.current = curLen;

    if (!pubInitRef.current && curLen > 0) {
      pubInitRef.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (curLen <= prevLen) return;

    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (near) {
      el.scrollTop = el.scrollHeight;
    } else {
      const latest = messages[curLen - 1];
      if (latest && !latest.localSent) setScrollBadge((n) => n + 1);
      setShowScrollBtn(true);
    }
  }, [messages]);

  useEffect(() => {
    const el = privMsgsRef.current;
    if (!el) return;

    const prevLen = privPrevLenRef.current;
    const curLen = privateMessages.length;
    privPrevLenRef.current = curLen;

    if (!privInitRef.current && curLen > 0) {
      privInitRef.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (curLen <= prevLen) return;

    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (near) {
      el.scrollTop = el.scrollHeight;
    } else {
      const latest = privateMessages[curLen - 1];
      if (latest && !latest.localSent) setPrivateScrollBadge((n) => n + 1);
      setShowPrivateScrollBtn(true);
    }
  }, [privateMessages]);

  /* v20.7 — DM auto-scroll */
  useEffect(() => {
    const el = dmMsgsRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [dmMessages, dmPanel?.threadId]);

  /* v20.7 — typing indicator auto-clear */
  useEffect(() => {
    const tmr = setInterval(() => {
      setDmTypingFrom((p) => {
        if (!p) return p;
        if (Date.now() - p.at > 3000) return null;
        return p;
      });
    }, 1000);
    return () => clearInterval(tmr);
  }, []);

  useEffect(() => {
    const tmr = setInterval(() => {
      const cut = Date.now() - 60 * 60 * 1000;
      setMessages((p) => p.map((m) => (m.image && m.createdAt < cut ? { ...m, image: undefined } : m)));
      setPrivateMessages((p) => p.map((m) => (m.image && m.createdAt < cut ? { ...m, image: undefined } : m)));
    }, 60 * 1000);
    return () => clearInterval(tmr);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const cut = Date.now() - 3000;
      setTypingPublic((p) => {
        const entries = Object.entries(p);
        const filtered = entries.filter(([, v]) => v.at > cut);
        if (filtered.length === entries.length) return p;
        const n: typeof p = {};
        for (const [k, v] of filtered) n[k] = v;
        return n;
      });
      setTypingRoom((p) => {
        const entries = Object.entries(p);
        const filtered = entries.filter(([, v]) => v.at > cut);
        if (filtered.length === entries.length) return p;
        const n: typeof p = {};
        for (const [k, v] of filtered) n[k] = v;
        return n;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const render = (title: string, detail: string) => {
      const el = document.createElement("pre");
      el.style.cssText =
        "position:fixed;inset:0;z-index:99999;margin:0;padding:20px;" +
        "background:#000;color:#ff5b7c;font-family:monospace;font-size:13px;" +
        "line-height:1.5;white-space:pre-wrap;overflow:auto;";
      el.textContent = "ANON// " + title + "\n\n" + detail;
      document.body.appendChild(el);
    };
    const onError = (e: ErrorEvent) => {
      render("RUNTIME ERROR", `${e.message}\n\nFile: ${e.filename}\nLine: ${e.lineno}:${e.colno}\n\nStack:\n${e.error?.stack || "(no stack)"}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      render("PROMISE REJECTION", String(e.reason?.stack || e.reason));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    const pubEl = msgsRef.current;
    const privEl = privMsgsRef.current;

    const onPub = () => {
      if (!pubEl || pubScrollingRef.current) return;
      const near = pubEl.scrollHeight - pubEl.scrollTop - pubEl.clientHeight < NEAR_BOTTOM_PX;
      if (near) {
        setShowScrollBtn(false);
        setScrollBadge(0);
      } else {
        setShowScrollBtn(true);
      }
    };
    const onPriv = () => {
      if (!privEl || privScrollingRef.current) return;
      const near = privEl.scrollHeight - privEl.scrollTop - privEl.clientHeight < NEAR_BOTTOM_PX;
      if (near) {
        setShowPrivateScrollBtn(false);
        setPrivateScrollBadge(0);
      } else {
        setShowPrivateScrollBtn(true);
      }
    };

    pubEl?.addEventListener("scroll", onPub, { passive: true });
    privEl?.addEventListener("scroll", onPriv, { passive: true });
    return () => {
      pubEl?.removeEventListener("scroll", onPub);
      privEl?.removeEventListener("scroll", onPriv);
    };
  }, [section, room?.roomId]);

  const scrollToBottomPublic = useCallback(() => {
    const el = msgsRef.current;
    if (!el) return;
    pubScrollingRef.current = true;
    setShowScrollBtn(false);
    setScrollBadge(0);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setTimeout(() => { pubScrollingRef.current = false; }, 600);
  }, []);

  const scrollToBottomPrivate = useCallback(() => {
    const el = privMsgsRef.current;
    if (!el) return;
    privScrollingRef.current = true;
    setShowPrivateScrollBtn(false);
    setPrivateScrollBadge(0);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setTimeout(() => { privScrollingRef.current = false; }, 600);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryReconnect = () => {
      const s = socketRef.current;
      if (!s) return;
      if (!s.connected) { try { s.connect(); } catch { /* ignore */ } }
    };
    const onVis = () => { if (document.visibilityState === "visible") tryReconnect(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tryReconnect);
    window.addEventListener("pageshow", tryReconnect);
    window.addEventListener("online", tryReconnect);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", tryReconnect);
      window.removeEventListener("pageshow", tryReconnect);
      window.removeEventListener("online", tryReconnect);
    };
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string, roomId?: string) => {
    setReactions((prev) => {
      const list = prev[messageId] ? [...prev[messageId]] : [];
      const idx = list.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const cur = list[idx];
        if (cur.mine) {
          const next = { emoji, count: cur.count - 1, mine: false };
          if (next.count <= 0) list.splice(idx, 1);
          else list[idx] = next;
        } else {
          list[idx] = { emoji, count: cur.count + 1, mine: true };
        }
      } else {
        list.push({ emoji, count: 1, mine: true });
      }
      return { ...prev, [messageId]: list };
    });
    setReactionPickerFor(null);

    const s = socketRef.current;
    if (!s) return;
    const payload: any = { messageId, emoji };
    if (roomId) payload.roomId = roomId;
    const doSend = () => {
      s.emit("reaction:toggle", payload, (ack: any) => {
        if (ack && ack.ok === false) {
          console.warn("[reaction] server rejected:", ack.error);
          // rollback the optimistic local change
          setReactions((prev) => {
            const list = prev[messageId] ? [...prev[messageId]] : [];
            const idx = list.findIndex((r) => r.emoji === emoji);
            if (idx >= 0) {
              const cur = list[idx];
              if (cur.mine) {
                const next = { emoji, count: cur.count - 1, mine: false };
                if (next.count <= 0) list.splice(idx, 1);
                else list[idx] = next;
              }
            }
            return { ...prev, [messageId]: list };
          });
        }
      });
    };
    if (!s.connected) { s.once("connect", doSend); try { s.connect(); } catch { /* ignore */ } }
    else { doSend(); }
  }, []);

  const startReply = useCallback((m: ChatMessage) => {
    setReplyTo(m); setMessageMenuFor(null); setEditingId(null);
  }, []);

  const cancelReply = useCallback(() => { setReplyTo(null); }, []);

  const startEdit = useCallback((m: ChatMessage, roomId?: string) => {
    setEditingId(m.id); setEditingText(m.content); setEditingRoomId(roomId ?? null);
    setMessageMenuFor(null); setReplyTo(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null); setEditingText(""); setEditingRoomId(null);
  }, []);

  const submitEdit = useCallback(() => {
    const text = editingText.trim();
    if (!text || !editingId) return;
    socketRef.current?.emit("message:edit", { messageId: editingId, content: text, roomId: editingRoomId ?? undefined }, () => {});
    const now = Date.now();
    setMessages((p) => p.map((m) => (m.id === editingId ? { ...m, content: text, editedAt: now } : m)));
    setPrivateMessages((p) => p.map((m) => (m.id === editingId ? { ...m, content: text, editedAt: now } : m)));
    persistUpdate(editingId, { content: text, editedAt: now });
    setEditingId(null); setEditingText(""); setEditingRoomId(null);
  }, [editingText, editingId, editingRoomId]);

  const deleteMessage = useCallback((m: ChatMessage, roomId?: string) => {
    socketRef.current?.emit("message:delete", { messageId: m.id, roomId }, () => {});
    setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, deleted: true, content: "" } : x)));
    setPrivateMessages((p) => p.map((x) => (x.id === m.id ? { ...x, deleted: true, content: "" } : x)));
    persistUpdate(m.id, { deleted: true, content: "" });
    setMessageMenuFor(null);
  }, []);

  const copyMessage = useCallback((content: string) => {
    try { navigator.clipboard?.writeText(content); showToast("Copied"); }
    catch { showToast("Copy failed"); }
    setMessageMenuFor(null);
  }, [showToast]);

  const blockUser = useCallback((sessionId: string, username: string) => {
    socketRef.current?.emit("block:user", { targetSessionId: sessionId, targetUsername: username }, (res: any) => {
      if (res?.ok) {
        showToast(t("userBlocked", { name: username }), 2000);
        socketRef.current?.emit("blocked:list", {}, (r: any) => { if (r?.ok) setBlockedList(r.blocked); });
      } else {
        showToast(res?.error || t("couldNotBlock"));
      }
    });
  }, [t, showToast]);

  const insertEmoji = useCallback((e: string, target: "public" | "room") => {
    const ref = target === "public" ? inputRef : privateInputRef;
    if (ref.current) {
      ref.current.value = (ref.current.value || "") + e;
      ref.current.dispatchEvent(new Event("input", { bubbles: true }));
      ref.current.focus();
    }
  }, []);

  /* v20.7 — DM functions */
  const openDm = useCallback((targetSessionId: string, targetUsername: string) => {
    const s = socketRef.current;
    if (!s) { showToast("Not connected"); return; }
    if (targetSessionId === identity?.sessionId) return;

    setDmMessages([]);
    setDmTypingFrom(null);
    setMessageMenuFor(null);

    setDmPanel({
      target: { sessionId: targetSessionId, username: targetUsername },
      loading: true,
    });

    s.emit("dm:open", { targetSessionId }, (res: any) => {
      if (!res?.ok) {
        showToast(res?.error || "Could not open DM");
        setDmPanel(null);
        return;
      }
      setDmMessages(res.thread.messages || []);
      setDmPanel({
        target: { sessionId: targetSessionId, username: targetUsername },
        threadId: res.thread.threadId,
        loading: false,
      });
    });
  }, [identity, showToast]);

  const closeDm = useCallback(() => {
    setDmPanel(null);
    setDmMessages([]);
    setDmTypingFrom(null);
  }, []);

  const sendDm = useCallback(() => {
    const el = dmInputRef.current;
    const text = (el?.value ?? "").trim();
    if (!text || !dmPanel?.threadId) return;
    if (el) el.value = "";
    socketRef.current?.emit("dm:send", { threadId: dmPanel.threadId, content: text }, () => {});
  }, [dmPanel]);

  const notifyDmTyping = useCallback(() => {
    if (!dmPanel?.threadId) return;
    const now = Date.now();
    if (now - dmLastTypingRef.current < 1200) return;
    dmLastTypingRef.current = now;
    socketRef.current?.emit("dm:typing", { threadId: dmPanel.threadId });
  }, [dmPanel]);

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
  }
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load failed"));
      img.src = src;
    });
  }
  function renderToJpeg(img: HTMLImageElement, maxDim: number, quality: number): string {
    let { width, height } = img;
    if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
    else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, width, height);
    return c.toDataURL("image/jpeg", quality);
  }
  async function compressImage(file: File): Promise<string> {
    if (file.size > 15 * 1024 * 1024) throw new Error("Image too large (>15 MB)");
    const raw = await readFileAsDataURL(file);
    const img = await loadImage(raw);
    const dims = [1200, 1000, 800, 600, 400];
    const quals = [0.82, 0.7, 0.55, 0.4];
    for (const d of dims) {
      for (const q of quals) {
        const out = renderToJpeg(img, d, q);
        if (out && out.length < 260 * 1024) return out;
      }
    }
    throw new Error("Could not compress under 200 KB");
  }
  function openImagePicker(target: "public" | "room") {
    setImageTarget(target);
    fileInputRef.current?.click();
  }
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Not an image file"); return; }
    setImageUploading(true);
    try {
      const b64 = await compressImage(file);
      const replyPayload = replyTo ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content } : undefined;
      if (imageTarget === "public") {
        const caption = (inputRef.current?.value ?? "").trim();
        socketRef.current?.emit("chat:public:image", { image: b64, caption, replyTo: replyPayload }, (ack: any) => {
          if (!ack?.ok) showToast(ack?.error || "Failed to send");
        });
        if (inputRef.current) inputRef.current.value = "";
      } else {
        if (!room) { showToast("No room"); return; }
        const caption = (privateInputRef.current?.value ?? "").trim();
        socketRef.current?.emit("room:image", { roomId: room.roomId, image: b64, caption, replyTo: replyPayload }, (ack: any) => {
          if (!ack?.ok) showToast(ack?.error || "Failed to send");
        });
        if (privateInputRef.current) privateInputRef.current.value = "";
      }
      setReplyTo(null);
    } catch (err: any) { showToast(err?.message || "Image failed"); }
    finally { setImageUploading(false); }
  }

  function notifyTyping(scope: "public" | "room") {
    const now = Date.now();
    if (now - lastTypingRef.current < 1200) return;
    lastTypingRef.current = now;
    if (scope === "public") socketRef.current?.emit("typing:public");
    else if (scope === "room" && room) socketRef.current?.emit("typing:room", { roomId: room.roomId });
  }

  function chooseName(newName: string) {
    localStorage.setItem(LS_USERNAME, newName);
    localStorage.setItem(LS_LAST_OFFER, String(Date.now()));
    localStorage.removeItem(LS_PENDING);
    setNameOffer(null);
    socketRef.current?.emit("user:rename", { username: newName }, (res: any) => {
      if (res?.ok) showToast(t("youAreNow", { name: newName }));
    });
  }
  function keepCurrentName() {
    localStorage.setItem(LS_LAST_OFFER, String(Date.now()));
    localStorage.removeItem(LS_PENDING);
    setNameOffer(null);
  }

  function openDoor(id: Section) {
    if (opening) return;
    setOpening(id);
    playSound("door");
    setTimeout(() => setFlash(true), 700);
    setTimeout(() => setGone(true), 860);
    setTimeout(() => { setFlash(false); setSection(id); setOpening(null); }, 1050);
  }
  function goBack() { setSection(null); setGone(false); setOpening(null); }

  function sendMessage() {
    const el = inputRef.current;
    const text = (el?.value ?? "").trim();
    if (!text) return;
    bumpSent();
    const replyPayload = replyTo ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content } : undefined;
    if (el) el.value = "";
    if (!connected || isOffline) {
      const q = enqueue(text);
      setQueued((p) => [...p, q]);
      setReplyTo(null);
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      senderSessionId: identity?.sessionId ?? "me",
      senderName: identity?.username ?? "you",
      content: text,
      createdAt: Date.now(),
      localSent: true,
      replyTo: replyPayload,
    };
    startTransition(() => setMessages((p) => [...p.slice(-499), tempMsg]));
    if (socketRef.current) {
      socketRef.current.emit("chat:public:send", { content: text, replyTo: replyPayload }, () => {});
    }
    setReplyTo(null);
  }
  function sendPrivate() {
    const el = privateInputRef.current;
    const text = (el?.value ?? "").trim();
    if (!text || !room || !socketRef.current) return;
    const replyPayload = replyTo ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content } : undefined;
    if (el) el.value = "";
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      senderSessionId: identity?.sessionId ?? "me",
      senderName: identity?.username ?? "you",
      content: text,
      createdAt: Date.now(),
      localSent: true,
      replyTo: replyPayload,
    };
    startTransition(() => setPrivateMessages((p) => [...p.slice(-499), tempMsg]));
    socketRef.current.emit("room:message", { roomId: room.roomId, content: text, replyTo: replyPayload }, () => {});
    setReplyTo(null);
  }
  function createRoom(capacity: number) {
    const cap = Math.max(2, Math.min(10, Number(capacity) || 5));
    const topic = createTopic.trim().slice(0, 40);
    socketRef.current?.emit("room:create", { capacity: cap, topic }, (res: any) => {
      if (!res?.ok) { showToast(res?.error || t("couldNotCreate")); return; }
      setRoom(res.room);
      setPrivateMessages([]);
      setRoomSystemLines([]);
      setCreateOpen(false);
      setCreateCapacity(5);
      setCreateTopic("");
    });
  }
  function inviteToRoom(username: string) {
    if (!room || !socketRef.current) return;
    socketRef.current.emit("room:invite", { roomId: room.roomId, recipientUsername: username }, (res: any) => {
      showToast(res?.ok ? t("invitationSentTo", { name: username }) : (res?.error || t("couldNotSend")));
    });
    setInviteOpen(false);
  }
  function submitManualInvite() {
    const name = inviteManual.trim();
    if (!name) return;
    inviteToRoom(name);
    setInviteManual("");
  }
  function acceptInvite(inv: Invite) {
    socketRef.current?.emit("invite:accept", { inviteId: inv.inviteId }, (res: any) => {
      if (!res?.ok) { showToast(res?.error || t("couldNotAccept")); }
      else { setRoom(res.room); setPrivateMessages([]); setRoomSystemLines([]); setSection("private"); }
    });
    setInvites((p) => p.filter((i) => i.inviteId !== inv.inviteId));
  }
  function declineInvite(inv: Invite) {
    socketRef.current?.emit("invite:decline", { inviteId: inv.inviteId });
    setInvites((p) => p.filter((i) => i.inviteId !== inv.inviteId));
  }
  function leavePrivate() {
    if (!room || !socketRef.current) return;
    socketRef.current.emit("room:leave", { roomId: room.roomId });
    setRoom(null); setPrivateMessages([]); setRoomSystemLines([]); setMemberMenuFor(null);
  }

  function kickMember(sessionId: string, username: string) {
    if (!room) return;
    socketRef.current?.emit("room:kick", { roomId: room.roomId, targetSessionId: sessionId }, (res: any) => {
      if (res?.ok) showToast(`${username} was kicked.`, 2000);
      else showToast(res?.error || "Could not kick.");
    });
    setMemberMenuFor(null);
  }

  function timeoutMember(sessionId: string, username: string, durationMs: number) {
    if (!room) return;
    socketRef.current?.emit("room:timeout", { roomId: room.roomId, targetSessionId: sessionId, durationMs }, (res: any) => {
      if (res?.ok) {
        const mins = Math.round(durationMs / 60000);
        showToast(`${username} timed out for ${mins}m.`, 2000);
      } else {
        showToast(res?.error || "Could not timeout.");
      }
    });
    setMemberMenuFor(null);
  }

  function clearTimeoutFor(sessionId: string, username: string) {
    if (!room) return;
    socketRef.current?.emit("room:clear-timeout", { roomId: room.roomId, targetSessionId: sessionId }, (res: any) => {
      if (res?.ok) showToast(`${username}'s timeout cleared.`, 2000);
      else showToast(res?.error || "Could not clear timeout.");
    });
    setMemberMenuFor(null);
  }

  function transferAdminTo(sessionId: string, username: string) {
    if (!room) return;
    socketRef.current?.emit("room:transfer-admin", { roomId: room.roomId, targetSessionId: sessionId }, (res: any) => {
      if (res?.ok) showToast(`${username} is now admin.`, 2500);
      else showToast(res?.error || "Could not transfer.");
    });
    setMemberMenuFor(null);
  }
  /* v20.8 — topic editor */
  function startTopicEdit() {
    if (!room || !isAdmin) return;
    setTopicDraft(room.topic || "");
    setTopicEditing(true);
  }

  function cancelTopicEdit() {
    setTopicEditing(false);
    setTopicDraft("");
  }

  function saveTopic() {
    if (!room) return;
    const next = topicDraft.trim().slice(0, 40);
    socketRef.current?.emit("room:set-topic", { roomId: room.roomId, topic: next }, (res: any) => {
      if (res?.ok) showToast("Room renamed", 1500);
      else showToast(res?.error || "Could not rename");
    });
    setTopicEditing(false);
    setTopicDraft("");
  }

  /* v20.8 — slow mode */
  function setSlowMode(sec: number) {
    if (!room) return;
    socketRef.current?.emit("room:set-slowmode", { roomId: room.roomId, seconds: sec }, (res: any) => {
      if (res?.ok) showToast(sec === 0 ? "Slow mode off" : `Slow mode: ${sec}s`, 1500);
      else showToast(res?.error || "Could not set slow mode");
    });
    setSettingsOpen(false);
  }

  /* v20.8 — room discovery */
  const refreshRoomList = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    setRoomListLoading(true);
    s.emit("room:list", {}, (res: any) => {
      setRoomListLoading(false);
      if (res?.ok && Array.isArray(res.rooms)) setRoomList(res.rooms);
    });
  }, []);

  useEffect(() => {
    if (section === "private" && !room) {
      refreshRoomList();
      const tmr = setInterval(refreshRoomList, 15000);
      return () => clearInterval(tmr);
    }
  }, [section, room, refreshRoomList]);

  function sendReport(reason: string) {
    if (!reportOpen) return;
    socketRef.current?.emit("report:user", {
      targetSessionId: reportOpen.sessionId,
      targetUsername: reportOpen.username,
      reason,
    }, () => {});
    setReportOpen(null);
    showToast(t("reportSubmitted"));
  }
  function unblockUser(sessionId: string, username: string) {
    socketRef.current?.emit("unblock:user", { targetSessionId: sessionId }, (res: any) => {
      if (res?.ok) {
        showToast(t("userUnblocked", { name: username }), 2000);
        socketRef.current?.emit("blocked:list", {}, (r: any) => { if (r?.ok) setBlockedList(r.blocked); });
      }
    });
  }
  function refreshBlocked() {
    socketRef.current?.emit("blocked:list", {}, (res: any) => {
      if (res?.ok) setBlockedList(res.blocked);
    });
  }

  const others = online.filter((u) => u.sessionId !== identity?.sessionId);
  const availableOthers = others.filter((u) => u.status !== "in-room");
  const isFull = room ? room.participants.length >= room.capacity : false;
  const isHost = room ? room.host === identity?.sessionId : false;
  const isAdmin = room ? room.admin === identity?.sessionId : false;

  const visibleMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()) || m.senderName.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;
  const visiblePrivateMessages = searchQuery.trim()
    ? privateMessages.filter((m) => m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()) || m.senderName.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : privateMessages;

  return (    <>
      {!connected && <div className="reconnectBar">{t("connectionLost")}</div>}

      <div className="marquee">
        <div className="marquee-track">
          <span>{t("marqueeA")} <b>{t("marqueeB")}</b></span>
          <span>{t("marqueeA")} <b>{t("marqueeB")}</b></span>
          <span>{t("marqueeA")} <b>{t("marqueeB")}</b></span>
        </div>
      </div>

      <div className={`flash ${flash ? "on" : ""}`} />

      <div className="ambient" aria-hidden="true">
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="spark"
            style={{
              left: s.left,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `-${s.delay}s`,
              ["--drift" as any]: `${s.drift}px`,
            }}
          />
        ))}
      </div>

      {nameOffer && (
        <div className="nameOfferBg">
          <div className="nameOffer">
            <div className="eyebrow">{t("itsBeenAWeek")}</div>
            <h2>{t("newIdentity")}</h2>
            <p>{t("chooseOneOrKeep", { name: identity?.username || t("keepMyName") })}</p>
            <div className="nameOptions">
              <button className="nameOption" onClick={() => chooseName(nameOffer.a)}>
                <span>{nameOffer.a}</span><small>{t("chooseThis")}</small>
              </button>
              <button className="nameOption" onClick={() => chooseName(nameOffer.b)}>
                <span>{nameOffer.b}</span><small>{t("chooseThis")}</small>
              </button>
            </div>
            <button className="keepName" onClick={keepCurrentName}>
              {t("keepName", { name: identity?.username || t("keepMyName") })}
            </button>
          </div>
        </div>
      )}

      {section === null && (
        <section className={`scene ${gone ? "gone" : ""}`}>
          <div className="cyberHud" aria-hidden="true">
            <span className="chBeam chB1" />
            <span className="chBeam chB2" />
            <span className="chBeam chB3" />
            <span className="chBeam chB4" />
            <span className="chWing chWingL" />
            <span className="chWing chWingR" />
            <span className="chUnderline" />
          </div>

          <header className="topbar">
            <div className="brandBlock">
              <svg className="pulseIcon" viewBox="0 0 40 40" aria-hidden="true">
                <path d="M2 20 L10 20 L14 12 L20 28 L26 18 L30 22 L38 22"
                  stroke="#ff2d55" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="2" cy="20" r="1.5" fill="#ff2d55"/>
                <circle cx="38" cy="22" r="1.5" fill="#ff2d55"/>
              </svg>
              <div className="brandText">
                <div className="brandLogo">ANON<i>//</i></div>
                <div className="brandTag">{t("brandTagline")}</div>
              </div>
            </div>

            <nav className="centerNav">
              <button className="navItem active">{t("navHome")}</button>
              <button className="navItem" onClick={() => openDoor("chat")}>{t("navConnect")}</button>
              <button className="navItem" onClick={() => openDoor("content")}>{t("navExplore")}</button>
              <button className="navItem" onClick={() => openDoor("content")}>{t("navLearn")}</button>
              <Link className="navItem" href="/data">DATA</Link>
            </nav>

            <div className="rightBar">
              <div className="onlinePill">
                <span className="onlineDot" />
                <div className="onlinePillText">
                  <div className="onlinePillTop">{t("online")}</div>
                  <div className="onlinePillBot">{online.length} {t("usersLabel")}</div>
                </div>
              </div>

              <div className="langWrap">
                <button
                  ref={langBtnRef}
                  className="langBtn"
                  onClick={() => {
                    const next = !langOpen;
                    setLangOpen(next);
                    if (next && langBtnRef.current) {
                      const r = langBtnRef.current.getBoundingClientRect();
                      setLangMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
                    }
                  }}
                >
                  <span className="globeIcon">◐</span> {lang.toUpperCase()} <span className="caret">▾</span>
                </button>
                {langOpen && langMenuPos && typeof document !== "undefined" &&
                  createPortal(
                    <div
                      className="langMenu langMenuPortal"
                      style={{
                        position: "fixed",
                        top: langMenuPos.top,
                        right: langMenuPos.right,
                        left: "auto",
                        zIndex: 9999,
                      }}
                    >
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          className={lang === l.code ? "active" : ""}
                          onClick={() => { setLang(l.code); setLangOpen(false); }}
                        >
                          <span>{l.native}</span>
                          <small>{l.code.toUpperCase()}</small>
                        </button>
                      ))}
                    </div>,
                    document.body
                  )
                }
              </div>

              <button className="iconBtn" onClick={toggleMute} title={muted ? t("unmuteTitle") : t("muteTitle")}>
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          </header>

          <div className="heroWrap">
            <div className="hoodedBg" />

            <div className="heroGrid">
              <div className="heroLeft">
                <h1 className="bigLogo">ANON<i>//</i></h1>
                <div className="bigTag">{t("brandTagline")}</div>

                <div className="anonPanel">
                  <div className="anonPanelH">{t("youAreAnonymous")}</div>
                  <ul className="anonPanelList">
                    <li>{t("noticeItem1")}</li>
                    <li>{t("noticeItem2")}</li>
                    <li>{t("noticeItem3")}</li>
                  </ul>
                  <div className="anonPanelFooter">{t("noticeFooter")}</div>
                </div>
              </div>

              <div className="heroRight">
                <div className="graffitiRight">
                  {t("graffitiTR1")}<br/>
                  {t("graffitiTR2")}<br/>
                  {t("graffitiTR3")}
                </div>
              </div>
            </div>
          </div>

          <div className="tagsRow">
            <div className="tagGroup">{t("publicTag")}</div>
            <div className="tagGroup">{t("privateTag")}</div>
            <div className="tagGroup">{t("contentTag")}</div>
          </div>

          <div className="doorsWrap">
            <div className="doors">
              {doors.map((d) => (
                <button
                  key={d.id}
                  className={`doorArch ${opening === d.id ? "opening" : ""}`}
                  onClick={() => openDoor(d.id)}
                  aria-label={`${t("enter")} ${t(d.name as any)}`}
                >
                  <div className="doorIcon">{d.icon}</div>
                  <div className="doorName">{t(d.name as any)}</div>
                  <div className="doorDesc">{t(d.desc as any)}</div>
                  <div className="doorEnter">→ {t("enter")}</div>
                </button>
              ))}
            </div>
          </div>

          <footer className="foot">
            <div className="footLeft">ANON// v10 · cyber</div>
            <div className="footRight">
              <Link className="footLink accent" href="/data">◉ {t("dataLogTitle")}</Link>
              <span className="sep">/</span>
              <a className="footLink" href="/legal/privacy">{t("privacy")}</a>
              <span className="sep">/</span>
              <a className="footLink" href="/legal/terms">{t("terms")}</a>
              <span className="sep">/</span>
              <a className="footLink" href="/legal/rules">{t("rules")}</a>
            </div>
          </footer>
        </section>
      )}

      {section !== null && (
        <div className="app in" style={{ display: "block" }}>
          <header className="app-head">
            <button className="back" onClick={goBack} title={t("backTitle")}>←</button>
            <div className="app-brand">ANON<i>//</i></div>
            <nav className="app-nav">
              {(["chat", "private", "content"] as Section[]).map((v) => (
                <button key={v} className={section === v ? "active" : ""} onClick={() => setSection(v)}>
                  {v === "chat" ? t("navChat") : v === "private" ? t("navPrivate") : t("navContent")}
                </button>
              ))}
            </nav>
            <div className="app-id">
              <div className="app-ava" style={{ background: identity?.accent ?? "#360d18" }}>◈</div>
              <div className="txt">
                <small>{t("anonymousIdentity")}</small>
                <b>{identity?.username ?? "…"}</b>
              </div>
            </div>
          </header>

          <main className="app-main">
            <section className={`app-view ${section === "chat" ? "active" : ""}`}>
              <div className="hero">
                <div>
                  <div className="eyebrow">{t("publicSpace")}</div>
                  <h1>{t("anonymousChat")}</h1>
                  <p>{t("talkFreely")}</p>
                </div>
                <div className="online">● {online.length} {t("online")}</div>
              </div>
              <div className="card chat">
                <div className="bar">
                  <span>{t("publicLounge")}</span>
                  <span>
                    {Object.values(typingPublic).length > 0
                      ? <span className="typingLine">✎ {Object.values(typingPublic).map((tt) => tt.username).slice(0, 2).join(", ")} {t("typing")}…</span>
                      : connected ? "● " + t("live") : "○ " + t("offline")}
                  </span>
                  <button className="searchToggle" onClick={() => setSearchOpen(!searchOpen)} title="Search">
                    {searchOpen ? "✕" : "🔍"}
                  </button>
                </div>
                {searchOpen && (
                  <div className="searchBar">
                    <input autoFocus placeholder="Search messages…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <button className="searchClose" onClick={() => { setSearchQuery(""); setSearchOpen(false); }}>✕</button>
                  </div>
                )}
                <div className="msgsWrap">
                <div className="msgs" ref={msgsRef}>
                  {welcomeBack && (
                    <div className="welcomeBack">
                      <div className="wbText">
                        <b>{t("welcomeBackTitle")}</b>{" "}
                        {t("welcomeBackAway", { min: Math.max(1, Math.round(welcomeBack.awayFor / 60000)) })}
                        {welcomeBack.count === 1
                          ? " " + t("welcomeBackMsgsOne")
                          : welcomeBack.count > 1
                            ? " " + t("welcomeBackMsgsMany", { count: welcomeBack.count })
                            : t("welcomeBackNone")}
                      </div>
                      <button className="wbBtn" onClick={() => { setMissed([]); setWelcomeBack(null); }}>{t("dismiss")}</button>
                    </div>
                  )}

                  {missed.map((m) => (
                    <div className="msg missed" key={`missed-${m.id}`}>
                      <div className="mini">◇</div>
                      <div className="bubble">
                        <div className="meta">
                          <b>{m.senderName}</b>
                          <span className="timeChip">{timeShort(m.createdAt)}</span>
                          <span className="missedTag">{t("missedTag")}</span>
                        </div>
                        <div className="text">{m.content}</div>
                      </div>
                    </div>
                  ))}

                  {queued.map((q) => (
                    <div className="msg mine queuedMsg" key={`q-${q.id}`}>
                      <div className="bubble">
                        <div className="meta">
                          <b>{identity?.username ?? t("youLabel")}</b>
                          <span className="queuedTag">{t("queuedTag")}</span>
                        </div>
                        <div className="text">{q.content}</div>
                      </div>
                      <div className="mini" style={{ background: identity?.accent ?? "#160409" }}>◈</div>
                    </div>
                  ))}

                  {systemLines.map((l) => {
                    let text = "";
                    if (l.type === "join" && l.username) text = t("sysJoin", { name: l.username });
                    else if (l.type === "leave" && l.username) text = t("sysLeave", { name: l.username });
                    else if (l.type === "rename" && l.username && l.oldName) text = t("sysRename", { old: l.oldName, new: l.username });
                    if (!text) return null;
                    return <div className="sysLine" key={l.id}>— {text} —</div>;
                  })}

                  {visibleMessages.length === 0 && systemLines.length === 0 && missed.length === 0 && queued.length === 0 && (
                    <div className="empty-msg">{searchQuery ? "No matches." : t("noMessagesYet")}</div>
                  )}

                  {visibleMessages.map((m) => {
                    const mine = m.localSent === true || m.senderSessionId === identity?.sessionId;
                    return (
                      <MessageBubble
                        key={m.id}
                        m={m}
                        mine={mine}
                        isEditing={editingId === m.id}
                        editingText={editingId === m.id ? editingText : ""}
                        openTime={openTime}
                        reactions={reactions}
                        reactionPickerFor={reactionPickerFor}
                        messageMenuFor={messageMenuFor}
                        onToggleTime={toggleTime}
                        onToggleReaction={toggleReaction}
                        onSetReactionPickerFor={setReactionPickerFor}
                        onSetMessageMenuFor={setMessageMenuFor}
                        onStartReply={startReply}
                        onCopyMessage={copyMessage}
                        onStartEdit={startEdit}
                        onDeleteMessage={deleteMessage}
                        onSubmitEdit={submitEdit}
                        onCancelEdit={cancelEdit}
                        onSetEditingText={setEditingText}
                        onBlockUser={blockUser}
                        onSetReportOpen={setReportOpen}
                        onOpenLightbox={setImageLightbox}
                        onOpenDm={openDm}
                        t={t}
                        timeShort={timeShort}
                        timeFull={timeFull}
                        identity={identity}
                        REACTION_EMOJIS={REACTION_EMOJIS}
                      />
                    );
                  })}
                </div>
                {showScrollBtn && (
                  <button className="scrollDownBtn" onClick={scrollToBottomPublic} aria-label="Scroll to latest">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                    {scrollBadge > 0 && (
                      <span className="scrollBadge">{scrollBadge > 99 ? "99+" : scrollBadge}</span>
                    )}
                  </button>
                )}
                </div>
                <div className="composer">
                  {replyTo && (
                    <div className="replyBar">
                      <div className="replyInfo">
                        <div className="replyLabel">Replying to <b>{replyTo.senderName}</b></div>
                        <div className="replyPreview">{replyTo.content.slice(0, 100)}</div>
                      </div>
                      <button className="replyClose" onClick={cancelReply} title="Cancel reply">✕</button>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    placeholder={connected ? t("writeMessage") : t("connecting")}
                    disabled={false}
                    onChange={() => notifyTyping("public")}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <button className="attachBtn" onClick={() => openImagePicker("public")} title="Send image" disabled={imageUploading}>
                    {imageUploading ? "…" : "📎"}
                  </button>
                  <button className="emojiBtn" onClick={() => setEmojiOpen(!emojiOpen)} title="Emoji">😊</button>
                  <button className="send" onClick={sendMessage}>{t("send")}</button>
                  {emojiOpen && (
                    <div className="emojiPicker">
                      <div className="emojiTabs">
                        {Object.keys(EMOJI_PICKER).map((cat) => (
                          <button key={cat} className={emojiCategory === cat ? "active" : ""} onClick={() => setEmojiCategory(cat)}>{cat}</button>
                        ))}
                      </div>
                      <div className="emojiGrid">
                        {EMOJI_PICKER[emojiCategory].map((e) => (
                          <button key={e} className="emojiCell" onClick={() => insertEmoji(e, "public")}>{e}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className={`app-view ${section === "private" ? "active" : ""}`}>
              <div className="hero">
                <div>
                  <div className="eyebrow">{t("privateRooms")}</div>
                  <h1>{t("privateHeading")}</h1>
                  <p>{t("privateSub")}</p>
                </div>
              </div>

              {room ? (
                <div className="roomWrap">
                  <div className="card roomBar">
                    <div className="roomInfo">
                      <span className="roomDot" />
                      {isAdmin && <span className="adminCrown" title="You are admin">♛</span>}
                      {topicEditing ? (
                        <span className="topicEditWrap">
                          <input
                            className="topicEditInput"
                            autoFocus
                            maxLength={40}
                            value={topicDraft}
                            onChange={(e) => setTopicDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); saveTopic(); }
                              if (e.key === "Escape") { e.preventDefault(); cancelTopicEdit(); }
                            }}
                          />
                          <button className="topicEditSave" onClick={saveTopic} title="Save">✓</button>
                          <button className="topicEditCancel" onClick={cancelTopicEdit} title="Cancel">✕</button>
                        </span>
                      ) : (
                        <b
                          className={`roomTopicName ${isAdmin ? "editable" : ""}`}
                          onClick={isAdmin ? startTopicEdit : undefined}
                          title={isAdmin ? "Click to rename" : undefined}
                        >
                          {room.topic || t("room")}
                          {isAdmin && <span className="topicEditHint">✎</span>}
                        </b>
                      )}
                      <span className="roomCap">{room.participants.length}/{room.capacity}</span>
                      {room.slowMode > 0 && (
                        <span className="roomSlowPill" title={`Slow mode: ${room.slowMode}s between messages`}>
                          ⏱ {room.slowMode}s
                        </span>
                      )}
                    </div>
                    <div className="roomActions">
                      <button
                        className="ghostBtn sm"
                        onClick={() => setMemberListOpen(!memberListOpen)}
                        title="Toggle member list"
                      >
                        👥 {room.participants.length}
                      </button>
                      {isAdmin && (
                        <div className="settingsWrap">
                          <button
                            className={`ghostBtn sm ${settingsOpen ? "active" : ""}`}
                            onClick={() => setSettingsOpen(!settingsOpen)}
                            title="Room settings"
                          >⚙</button>
                          {settingsOpen && (
                            <div className="settingsMenu" onClick={(e) => e.stopPropagation()}>
                              <div className="settingsLabel">SLOW MODE</div>
                              {[0, 3, 5, 10, 30].map((sec) => (
                                <button
                                  key={sec}
                                  className={`settingsOpt ${room.slowMode === sec ? "active" : ""}`}
                                  onClick={() => setSlowMode(sec)}
                                >
                                  <span>{sec === 0 ? "Off" : `${sec}s`}</span>
                                  {room.slowMode === sec && <span className="settingsCheck">✓</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        className={`primary sm ${isFull ? "disabled" : ""}`}
                        onClick={() => { if (isFull) showToast(t("roomIsFull")); else setInviteOpen(true); }}
                      >+ {t("invite")}</button>
                      <button className="leave-btn" onClick={leavePrivate}>{t("leave")}</button>
                    </div>
                  </div>

                  <div className={`roomLayout ${memberListOpen ? "withMembers" : ""}`}>
                    <div className="card chat">
                      <div className="bar">
                        <span>{room.participants.map((p) => p.username).join(" · ")}</span>
                        <span>
                          {Object.values(typingRoom).length > 0
                            ? <span className="typingLine">✎ {Object.values(typingRoom).map((tt) => tt.username).slice(0, 2).join(", ")} {t("typing")}…</span>
                            : <span className="green">● {room.participants.length}/{room.capacity}</span>}
                        </span>
                        <button className="searchToggle" onClick={() => setSearchOpen(!searchOpen)} title="Search">
                          {searchOpen ? "✕" : "🔍"}
                        </button>
                      </div>
                      {searchOpen && (
                        <div className="searchBar">
                          <input autoFocus placeholder="Search messages…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                          <button className="searchClose" onClick={() => { setSearchQuery(""); setSearchOpen(false); }}>✕</button>
                        </div>
                      )}
                      <div className="msgsWrap">
                      <div className="msgs" ref={privMsgsRef}>
                        {visiblePrivateMessages.length === 0 && roomSystemLines.length === 0 && (
                          <div className="empty-msg">
                            {searchQuery ? "No matches." : (isFull ? t("roomFullStart") : t("waitingForSomeone"))}
                          </div>
                        )}

                        {roomSystemLines.map((l) => {
                          let text = "";
                          if (l.type === "join" && l.username) text = `${l.username} joined`;
                          else if (l.type === "leave" && l.username) text = `${l.username} left`;
                          else if (l.type === "kick" && l.username && l.by) text = `${l.username} was kicked by ${l.by}`;
                          else if (l.type === "timeout" && l.username && l.by) text = `${l.username} was timed out by ${l.by}`;
                          else if (l.type === "untimeout") text = `timeout cleared by ${l.by}`;
                          else if (l.type === "transfer" && l.from && l.to) text = `${l.from} transferred admin to ${l.to}`;
                          else if (l.type === "topic" && l.topic !== undefined) text = `room renamed to "${l.topic}"`;
                          else if (l.type === "slowmode") text = `slow mode set to ${l.seconds}s`;
                          if (!text) return null;
                          return <div className="sysLine" key={l.id}>— {text} —</div>;
                        })}

                        {visiblePrivateMessages.map((m) => {
                          const mine = m.localSent === true || m.senderSessionId === identity?.sessionId;
                          return (
                            <MessageBubble
                              key={m.id}
                              m={m}
                              mine={mine}
                              isEditing={editingId === m.id}
                              editingText={editingId === m.id ? editingText : ""}
                              openTime={openTime}
                              reactions={reactions}
                              reactionPickerFor={reactionPickerFor}
                              messageMenuFor={messageMenuFor}
                              roomId={room?.roomId}
                              onToggleTime={toggleTime}
                              onToggleReaction={toggleReaction}
                              onSetReactionPickerFor={setReactionPickerFor}
                              onSetMessageMenuFor={setMessageMenuFor}
                              onStartReply={startReply}
                              onCopyMessage={copyMessage}
                              onStartEdit={startEdit}
                              onDeleteMessage={deleteMessage}
                              onSubmitEdit={submitEdit}
                              onCancelEdit={cancelEdit}
                              onSetEditingText={setEditingText}
                              onBlockUser={blockUser}
                              onSetReportOpen={setReportOpen}
                              onOpenLightbox={setImageLightbox}
                              onOpenDm={openDm}
                              t={t}
                              timeShort={timeShort}
                              timeFull={timeFull}
                              identity={identity}
                              REACTION_EMOJIS={REACTION_EMOJIS}
                            />
                          );
                        })}
                      </div>
                      {showPrivateScrollBtn && (
                        <button className="scrollDownBtn" onClick={scrollToBottomPrivate} aria-label="Scroll to latest">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                          {privateScrollBadge > 0 && (
                            <span className="scrollBadge">{privateScrollBadge > 99 ? "99+" : privateScrollBadge}</span>
                          )}
                        </button>
                      )}
                      </div>
                      <div className="composer">
                        {replyTo && (
                          <div className="replyBar">
                            <div className="replyInfo">
                              <div className="replyLabel">Replying to <b>{replyTo.senderName}</b></div>
                              <div className="replyPreview">{replyTo.content.slice(0, 100)}</div>
                            </div>
                            <button className="replyClose" onClick={cancelReply} title="Cancel reply">✕</button>
                          </div>
                        )}
                        <input
                          ref={privateInputRef}
                          placeholder={t("writePrivateMessage")}
                          onChange={() => notifyTyping("room")}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrivate(); } }}
                        />
                        <button className="attachBtn" onClick={() => openImagePicker("room")} title="Send image" disabled={imageUploading}>
                          {imageUploading ? "…" : "📎"}
                        </button>
                        <button className="emojiBtn" onClick={() => setEmojiOpen(!emojiOpen)} title="Emoji">😊</button>
                        <button className="send" onClick={sendPrivate}>{t("send")}</button>
                        {emojiOpen && (
                          <div className="emojiPicker">
                            <div className="emojiTabs">
                              {Object.keys(EMOJI_PICKER).map((cat) => (
                                <button key={cat} className={emojiCategory === cat ? "active" : ""} onClick={() => setEmojiCategory(cat)}>{cat}</button>
                              ))}
                            </div>
                            <div className="emojiGrid">
                              {EMOJI_PICKER[emojiCategory].map((e) => (
                                <button key={e} className="emojiCell" onClick={() => insertEmoji(e, "room")}>{e}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {memberListOpen && (
                      <div className="card memberPanel">
                        <div className="memberHeader">
                          <span>MEMBERS</span>
                          <span className="memberCount">{room.participants.length}/{room.capacity}</span>
                        </div>
                        <div className="memberList">
                          {room.participants.map((p) => {
                            const isMe = p.sessionId === identity?.sessionId;
                            const isPAdmin = p.isAdmin;
                            const isTimedOut = p.timedOutUntil && p.timedOutUntil > Date.now();
                            const canModerate = isAdmin && !isMe;
                            const canDm = !isMe;
                            return (
                              <div
                                key={p.sessionId}
                                className={`memberRow ${isPAdmin ? "isAdmin" : ""} ${isTimedOut ? "isTimedOut" : ""} ${canModerate ? "clickable" : ""}`}
                                onClick={() => {
                                  if (canModerate) setMemberMenuFor(memberMenuFor === p.sessionId ? null : p.sessionId);
                                }}
                              >
                                <span className="memberAvatar">
                                  {isPAdmin ? "♛" : "◇"}
                                </span>
                                <span className="memberName">
                                  {p.username}
                                  {isMe && <span className="youTag">you</span>}
                                </span>
                                {isTimedOut && <span className="timeoutTag" title="Timed out">⏱</span>}
                                {canDm && (
                                  <button
                                    className="memberDmBtn"
                                    title="Private message"
                                    onClick={(e) => { e.stopPropagation(); openDm(p.sessionId, p.username); }}
                                  >💬</button>
                                )}
                                {canModerate && memberMenuFor === p.sessionId && (
                                  <div className="memberMenu" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => timeoutMember(p.sessionId, p.username, 60000)}>⏱ Timeout 1m</button>
                                    <button onClick={() => timeoutMember(p.sessionId, p.username, 3 * 60000)}>⏱ Timeout 3m</button>
                                    <button onClick={() => timeoutMember(p.sessionId, p.username, 5 * 60000)}>⏱ Timeout 5m</button>
                                    {isTimedOut && (
                                      <button onClick={() => clearTimeoutFor(p.sessionId, p.username)}>✓ Clear timeout</button>
                                    )}
                                    <button onClick={() => transferAdminTo(p.sessionId, p.username)}>♛ Make admin</button>
                                    <button className="danger" onClick={() => kickMember(p.sessionId, p.username)}>✕ Kick</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="private">
                  <div className="card rooms">
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <button className="invite" style={{ flex: 1 }} onClick={() => setCreateOpen(true)}>＋ {t("createRoom")}</button>
                      <button className="ghostBtn" onClick={() => { refreshBlocked(); setBlockedOpen(true); }} title={t("blockedUsers")}>
                        ⛔ {blockedList.length}
                      </button>
                    </div>

                    {invites.length > 0 && (
                      <div className="invites-list">
                        <h4>{t("incomingInvites")}</h4>
                        {invites.map((i) => (
                          <div className="invite-row" key={i.inviteId}>
                            <div>
                              <span>{i.from.username}</span>
                              <small style={{ display: "block", color: "#7c5a63", fontSize: 10, marginTop: 2 }}>
                                {i.capacity}{t("personRoom")} · {i.occupancy}/{i.capacity}
                              </small>
                            </div>
                            <div className="invite-actions">
                              <button className="primary sm" onClick={() => acceptInvite(i)}>{t("accept")}</button>
                              <button className="cancel sm" onClick={() => declineInvite(i)}>{t("decline")}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="online-list">
                      <h4>{t("online")} ({others.length})</h4>
                      {others.length === 0 && <div className="muted">{t("noOneElse")}</div>}
                      {others.map((u) => (
                        <div className="online-row" key={u.sessionId}>
                          <span className="dot" style={{ background: u.accent }} />
                          <span className="name">{u.username}</span>
                          <span className={`statusTag ${u.status === "in-room" ? "busy" : ""}`}>
                            {u.status === "in-room" ? t("inAPrivateRoom") : t("available")}
                          </span>
                          <button className="miniAct" onClick={() => openDm(u.sessionId, u.username)}>💬</button>
                          <button className="miniAct" onClick={() => blockUser(u.sessionId, u.username)}>{t("block")}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card empty">
                    <div className="discover">
                      <div className="discoverHead">
                        <div>
                          <div className="big">⌁</div>
                          <h2>{t("createAPrivateRoom")}</h2>
                          <p>{t("createPrivateRoomSub")}</p>
                        </div>
                        <button
                          className="discoverRefresh"
                          onClick={refreshRoomList}
                          disabled={roomListLoading}
                          title="Refresh rooms"
                        >
                          {roomListLoading ? "…" : "⟳"}
                        </button>
                      </div>

                      <div className="discoverListHeader">
                        <span>OPEN ROOMS</span>
                        <span className="discoverCount">{roomList.length}</span>
                      </div>

                      {roomList.length === 0 && !roomListLoading && (
                        <div className="discoverEmpty">No open rooms right now — be the first.</div>
                      )}

                      <div className="discoverList">
                        {roomList.map((r) => (
                          <div key={r.roomId} className={`discoverRow ${r.full ? "full" : ""}`}>
                            <span className="discoverIcon">◈</span>
                            <div className="discoverInfo">
                              <div className="discoverTopic">{r.topic || "Untitled room"}</div>
                              <div className="discoverMeta">
                                by {r.adminName}
                                {r.slowMode > 0 && <span className="discoverSlow"> · ⏱ {r.slowMode}s</span>}
                              </div>
                            </div>
                            <span className={`discoverCap ${r.full ? "full" : ""}`}>
                              {r.occupancy}/{r.capacity}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="discoverHint">
                        Ask a room admin to invite you — you can't join a room on your own yet.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className={`app-view ${section === "content" ? "active" : ""}`}>
              <div className="hero">
                <div>
                  <div className="eyebrow">{t("anonJournal")}</div>
                  <h1>{t("contentHeading")}</h1>
                  <p>{t("contentSub")}</p>
                </div>
              </div>
              <div className="content">
                {[
                  { tag: t("article1Tag"), title: t("article1Title"), body: t("article1Body") },
                  { tag: t("article2Tag"), title: t("article2Title"), body: t("article2Body") },
                  { tag: t("article3Tag"), title: t("article3Title"), body: t("article3Body") },
                ].map((a) => (
                  <article className="card article" key={a.title}>
                    <div className="cover" />
                    <div className="article-body">
                      <div className="tag">{a.tag}</div>
                      <h2>{a.title}</h2>
                      <p>{a.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main>
        </div>
      )}

      {createOpen && (
        <div className="modalbg show" onClick={() => setCreateOpen(false)}>
          <div className="modal modalCreateRoom" onClick={(e) => e.stopPropagation()}>
            <h2>{t("createRoomTitle")}</h2>
            <p>{t("createRoomSub")}</p>

            <div className="createField">
              <label className="createLabel">ROOM NAME</label>
              <input
                className="createTopicInput"
                type="text"
                placeholder="e.g. Cyber Lounge"
                maxLength={40}
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
              />
            </div>

            <div className="createField">
              <label className="createLabel">
                MAX PEOPLE
                <span className="createCapBadge">{createCapacity}</span>
              </label>
              <div className="capGrid">
                {[2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    className={`capChip ${createCapacity === n ? "active" : ""}`}
                    onClick={() => setCreateCapacity(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="actions">
              <button className="cancel" onClick={() => setCreateOpen(false)}>{t("cancel")}</button>
              <button className="primary" onClick={() => createRoom(createCapacity)}>
                {t("createRoom")}
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && room && (
        <div className="modalbg show" onClick={() => setInviteOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t("inviteSomeone")}</h2>
            <p>{t("inviteSub", { n: room.participants.length, cap: room.capacity })}</p>
            <div className="manualInvite">
              <input
                autoFocus
                placeholder={t("typeUsername")}
                value={inviteManual}
                onChange={(e) => setInviteManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitManualInvite(); } }}
              />
              <button type="button" className="primary sm" onClick={submitManualInvite}>{t("invite")}</button>
            </div>
            <div className="pickList" style={{ marginTop: 14 }}>
              {availableOthers.length === 0 && <div className="muted" style={{ padding: "10px 0" }}>{t("noUsersAvailable")}</div>}
              {availableOthers.map((u) => (
                <button key={u.sessionId} className="pickRow" onClick={() => inviteToRoom(u.username)}>
                  <span className="dot" style={{ background: u.accent }} />
                  <span className="name">{u.username}</span>
                  <span className="pick">{t("invite")} →</span>
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="cancel" onClick={() => { setInviteOpen(false); setInviteManual(""); }}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="modalbg show" onClick={() => setReportOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t("reportUser", { name: reportOpen.username })}</h2>
            <p>{t("whyReporting")}</p>
            <div className="reportOpts">
              {([
                ["spam", t("spam")],
                ["harassment", t("harassment")],
                ["inappropriate", t("inappropriate")],
                ["other", t("other")],
              ] as [string, string][]).map(([key, label]) => (
                <button key={key} className="reportBtn" onClick={() => sendReport(label)}>{label}</button>
              ))}
            </div>
            <div className="actions">
              <button className="cancel" onClick={() => setReportOpen(null)}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {blockedOpen && (
        <div className="modalbg show" onClick={() => setBlockedOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t("blockedTitle")}</h2>
            <p>{t("blockedSub")}</p>
            <div className="pickList">
              {blockedList.length === 0 && <div className="muted" style={{ padding: "10px 0" }}>{t("notBlockedAnyone")}</div>}
              {blockedList.map((b) => (
                <div key={b.sessionId} className="pickRow" style={{ cursor: "default" }}>
                  <span className="name">{b.username}</span>
                  <button className="miniAct" onClick={() => unblockUser(b.sessionId, b.username)}>{t("unblock")}</button>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="cancel" onClick={() => setBlockedOpen(false)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageSelect}
      />

      {imageLightbox && (
        <div className="lightbox" onClick={() => setImageLightbox(null)}>
          <button className="lightboxClose" onClick={() => setImageLightbox(null)}>✕</button>
          <img src={imageLightbox} alt="preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}

      {dmPanel && (
        <div className="dmPanel">
          <div className="dmHeader">
            <div className="dmAvatar">◇</div>
            <div className="dmTitle">
              <b>{dmPanel.target.username}</b>
              {dmTypingFrom
                ? <small className="dmTyping">typing…</small>
                : <small>private thread · 1h</small>}
            </div>
            <button className="dmClose" onClick={closeDm} title="Close">✕</button>
          </div>
          <div className="dmMsgs" ref={dmMsgsRef}>
            {dmPanel.loading && <div className="dmEmpty">Opening…</div>}
            {!dmPanel.loading && dmMessages.length === 0 && (
              <div className="dmEmpty">No messages yet — say hi 👋</div>
            )}
            {dmMessages.map((m) => (
              <div key={m.id} className={`dmMsg ${m.mine ? "mine" : ""}`}>
                <div className="dmBubble">{m.content}</div>
                <div className="dmMeta">{timeShort(m.createdAt)}</div>
              </div>
            ))}
          </div>
          <div className="dmComposer">
            <input
              ref={dmInputRef}
              placeholder={dmPanel.loading ? "Loading…" : "Message…"}
              disabled={dmPanel.loading || !dmPanel.threadId}
              onChange={notifyDmTyping}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDm(); } }}
            />
            <button className="dmSend" onClick={sendDm} disabled={dmPanel.loading || !dmPanel.threadId}>
              Send
            </button>
          </div>
        </div>
      )}

      {fp && section === null && (
        <a className="fpWidget" href="/data" title="View full data log">
          <svg viewBox="0 0 30 60" className="fpTube" aria-hidden="true">
            <defs>
              <linearGradient id="fpLiquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dffa8" stopOpacity="0.98" />
                <stop offset="100%" stopColor="#0e6b3a" stopOpacity="1" />
              </linearGradient>
              <clipPath id="fpClip">
                <rect x="4" y="4" width="22" height="52" rx="11" />
              </clipPath>
            </defs>
            <rect x="3" y="3" width="24" height="54" rx="12" fill="#050102" stroke="#143a24" strokeWidth="1.2" />
            <g clipPath="url(#fpClip)">
              <rect
                x="4"
                y={4 + 52 * (1 - fp.pctDeleted / 100)}
                width="22"
                height={52 * (fp.pctDeleted / 100)}
                fill="url(#fpLiquid)"
              />
              <ellipse cx="15" cy={4 + 52 * (1 - fp.pctDeleted / 100)} rx="11" ry="2" fill="#b8ffcf" opacity="0.8">
                <animate attributeName="ry" values="1.5;3;1.5" dur="2.4s" repeatCount="indefinite" />
              </ellipse>
            </g>
            <rect x="7" y="8" width="4" height="42" rx="2" fill="#ffffff" opacity="0.06" />
            <rect x="3" y="3" width="24" height="54" rx="12" fill="none" stroke="#35d27c" strokeOpacity="0.4" strokeWidth="0.8" />
          </svg>
          <div className="fpText">
            <div className="fpPct">{Math.round(fp.pctDeleted)}%</div>
            <div className="fpLabel">
              {fp.fullyDeleted ? "DELETED" : `DELETED · NEXT ${formatCountdown(fp.nextDecayInMs)}`}
            </div>
          </div>
        </a>
      )}
    </>
  );
}

/* ============================================================
   v16 — MessageBubble with CUSTOM memo comparator.
   v20.7 — Adds onOpenDm + click-to-DM on avatar.
   ============================================================ */
const MessageBubble = require("react").memo(
  function MessageBubble({
    m,
    mine,
    isEditing,
    editingText,
    openTime,
    reactions,
    reactionPickerFor,
    messageMenuFor,
    roomId,
    onToggleTime,
    onToggleReaction,
    onSetReactionPickerFor,
    onSetMessageMenuFor,
    onStartReply,
    onCopyMessage,
    onStartEdit,
    onDeleteMessage,
    onSubmitEdit,
    onCancelEdit,
    onSetEditingText,
    onBlockUser,
    onSetReportOpen,
    onOpenLightbox,
    onOpenDm,
    t,
    timeShort,
    timeFull,
    identity,
    REACTION_EMOJIS,
  }: any) {
    return (
      <div className={`msg ${mine ? "mine" : ""}`} data-mid={m.id}>
        {!mine && (
          <div
            className="mini clickable"
            onClick={() => onOpenDm?.(m.senderSessionId, m.senderName)}
            title="Private message"
          >◇</div>
        )}
        <div className="bubble">
          {m.replyTo && (
            <div className="quoteBlock" onClick={() => {
              const el = document.querySelector(`[data-mid="${m.replyTo!.id}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>
              <div className="quoteName">{m.replyTo.senderName}</div>
              <div className="quoteText">{m.replyTo.content}</div>
            </div>
          )}
          <div className="meta">
            <b>{m.senderName}</b>
            <button type="button" className="timeChip" title={timeFull(m.createdAt)} onClick={() => onToggleTime(m.id)}>
              {openTime[m.id] ? timeFull(m.createdAt) : timeShort(m.createdAt)}
            </button>
            {m.editedAt && !m.deleted && <span className="editedTag">(edited)</span>}
            {!mine && (
              <>
                <button className="miniAct" onClick={() => onSetReportOpen({ sessionId: m.senderSessionId, username: m.senderName })}>{t("report")}</button>
                <button className="miniAct" onClick={() => onBlockUser(m.senderSessionId, m.senderName)}>{t("block")}</button>
              </>
            )}
            {!m.deleted && (
              <button className="menuBtn" onClick={() => onSetMessageMenuFor(messageMenuFor === m.id ? null : m.id)} title="More">⋯</button>
            )}
            {messageMenuFor === m.id && (
              <div className="msgMenu">
                <button onClick={() => onStartReply(m)}>↩ Reply</button>
                {m.content && <button onClick={() => onCopyMessage(m.content)}>📋 Copy</button>}
                {!mine && (
                  <button onClick={() => onOpenDm(m.senderSessionId, m.senderName)}>💬 Private message</button>
                )}
                {mine && !m.image && <button onClick={() => roomId ? onStartEdit(m, roomId) : onStartEdit(m)}>✎ Edit</button>}
                {mine && <button className="danger" onClick={() => roomId ? onDeleteMessage(m, roomId) : onDeleteMessage(m)}>🗑 Delete</button>}
              </div>
            )}
          </div>
          {isEditing ? (
            <div className="editInline">
              <input
                autoFocus
                value={editingText}
                onChange={(e) => onSetEditingText(e.target.value)}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmitEdit(); }
                  if (e.key === "Escape") { e.preventDefault(); onCancelEdit(); }
                }}
              />
              <button className="send sm" onClick={onSubmitEdit}>{t("send")}</button>
              <button className="cancel sm" onClick={onCancelEdit}>{t("cancel")}</button>
            </div>
          ) : m.deleted ? (
            <div className="text deletedText"><i>This message was deleted</i></div>
          ) : (
            <>
              {m.image && (
                <div className="imageBubble" onClick={() => onOpenLightbox(m.image!)}>
                  <img src={m.image} alt="shared" loading="lazy" />
                  <div className="imageMeta">🎞️ RAM only · 60 min</div>
                </div>
              )}
              {m.content && <div className="text">{m.content}</div>}
            </>
          )}
          {!isEditing && (
            <div className="msgFoot">
              <div className="reactionRow">
                {(reactions[m.id] ?? []).map((r: any) => (
                  <button
                    key={r.emoji}
                    className={`reactionPill ${r.mine ? "mine" : ""}`}
                    onClick={() => roomId ? onToggleReaction(m.id, r.emoji, roomId) : onToggleReaction(m.id, r.emoji)}
                  >
                    <span className="rEmoji">{r.emoji}</span>
                    <span className="rCount">{r.count}</span>
                  </button>
                ))}
                {!m.deleted && (
                  <button
                    type="button"
                    className="reactionAdd"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      onSetReactionPickerFor(reactionPickerFor === m.id ? null : m.id);
                    }}
                    title="Add reaction"
                  >＋</button>
                )}
              </div>
              {reactionPickerFor === m.id && (
                <div className="reactionPicker" onClick={(ev) => ev.stopPropagation()}>
                  {REACTION_EMOJIS.map((e: string) => (
                    <button
                      key={e}
                      type="button"
                      className="reactionChoice"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (roomId) onToggleReaction(m.id, e, roomId);
                        else onToggleReaction(m.id, e);
                      }}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {mine && <div className="mini" style={{ background: identity?.accent ?? "#160409" }}>◈</div>}
      </div>
    );
  },
  (prev: any, next: any) => {
    if (prev.m !== next.m) return false;
    if (prev.mine !== next.mine) return false;
    if (prev.isEditing !== next.isEditing) return false;
    if (prev.isEditing && prev.editingText !== next.editingText) return false;
    if (prev.messageMenuFor !== next.messageMenuFor) return false;
    if (prev.reactionPickerFor !== next.reactionPickerFor) return false;
    if (prev.roomId !== next.roomId) return false;
    if (prev.openTime !== next.openTime) return false;
    if (prev.reactions !== next.reactions) return false;
    if (prev.identity !== next.identity) return false;
    if (prev.t !== next.t) return false;
    if (prev.timeShort !== next.timeShort) return false;
    if (prev.timeFull !== next.timeFull) return false;
    return true;
  }
);