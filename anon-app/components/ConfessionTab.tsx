"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Socket } from "socket.io-client";
import Identicon from "@/components/Identicon";
import { inspectSensitiveText, redactSensitiveText } from "@/lib/localPrivacyGuard";

type ConfessionReply = {
  id: string;
  author: string;
  text: string;
  createdAt: number;
};

type ConfessionPost = {
  id: string;
  text: string;
  author: string;
  createdAt: number;
  expiresAt: number;
  upvotes: number;
  downvotes: number;
  replies: ConfessionReply[];
  myVote?: 0 | 1 | -1;
  isMine?: boolean;
};

type ElectionState = {
  status: "closed" | "voting" | "finished" | string;
  winner?: string | null;
  startedAt?: number;
  endsAt?: number;
  voteCount?: number;
};

type ConfessionListResponse = {
  ok: boolean;
  error?: string;
  confessions?: ConfessionPost[];
  election?: ElectionState | null;
};

type MutationResponse = {
  ok: boolean;
  error?: string;
};

type ConfessionTabProps = {
  socket: Socket | null;
  connected: boolean;
};

type SortMode = "recent" | "liked" | "discussed";
type TimeWindow = "all" | "1h" | "12h" | "24h" | "7d";

const MAX_POST_LENGTH = 1000;
const MAX_REPLY_LENGTH = 400;

const SORT_OPTIONS: Array<{ id: SortMode; label: string; detail: string }> = [
  { id: "recent", label: "Recent", detail: "Newest first" },
  { id: "liked", label: "Most liked", detail: "Most upvoted" },
  { id: "discussed", label: "Most discussed", detail: "Most replies" },
];

const TIME_OPTIONS: Array<{ id: TimeWindow; label: string }> = [
  { id: "all", label: "All time" },
  { id: "1h", label: "1 hour" },
  { id: "12h", label: "12 hours" },
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
];

const WINDOW_MS: Record<Exclude<TimeWindow, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

function timeAgo(timestamp: number, now: number) {
  if (!now) return "just now";
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 60 * 60 * 1000) return Math.floor(elapsed / 60_000) + "m ago";
  if (elapsed < 24 * 60 * 60 * 1000) return Math.floor(elapsed / (60 * 60 * 1000)) + "h ago";
  return Math.floor(elapsed / (24 * 60 * 60 * 1000)) + "d ago";
}

function expiryText(expiresAt: number, now: number) {
  if (!now) return "7-day lifetime";
  const remaining = expiresAt - now;
  if (remaining <= 0) return "expiring";
  if (remaining < 60 * 60 * 1000) return "expires in " + Math.max(1, Math.floor(remaining / 60_000)) + "m";
  if (remaining < 24 * 60 * 60 * 1000) return "expires in " + Math.floor(remaining / (60 * 60 * 1000)) + "h";
  return "expires in " + Math.ceil(remaining / (24 * 60 * 60 * 1000)) + "d";
}

export default function ConfessionTab({ socket, connected }: ConfessionTabProps) {
  const [posts, setPosts] = useState<ConfessionPost[]>([]);
  const [election, setElection] = useState<ElectionState | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [now, setNow] = useState(0);
  const [privacyReview, setPrivacyReview] = useState<{
    target: "post" | "reply";
    text: string;
    findings: string[];
    confessionId?: string;
  } | null>(null);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;

    let active = true;

    const fetchList = () => {
      socket.emit("confession:list", {}, (response: ConfessionListResponse) => {
        if (!active) return;
        if (response?.ok) {
          setPosts(Array.isArray(response.confessions) ? response.confessions : []);
          setElection(response.election || null);
          setLoading(false);
        } else {
          setStatus(response?.error || "The live feed could not be loaded.");
          setLoading(false);
        }
      });
    };

    fetchList();
    socket.on("confession:update", fetchList);
    return () => {
      active = false;
      socket.off("confession:update", fetchList);
    };
  }, [socket, connected]);

  const visiblePosts = useMemo(() => {
    const current = now || 0;
    let result = posts.filter((item) => item.expiresAt > current);

    if (timeWindow !== "all") {
      const cutoff = current - WINDOW_MS[timeWindow];
      result = result.filter((item) => item.createdAt >= cutoff);
    }

    const term = query.trim().toLowerCase();
    if (term) {
      result = result.filter((item) => {
        const searchable = [
          item.text,
          item.author,
          ...item.replies.map((reply) => reply.text),
          ...item.replies.map((reply) => reply.author),
        ].join(" ").toLowerCase();
        return searchable.includes(term);
      });
    }

    result.sort((a, b) => {
      if (sortBy === "liked") {
        return (b.upvotes - a.upvotes) ||
          ((b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)) ||
          (b.createdAt - a.createdAt);
      }
      if (sortBy === "discussed") {
        return (b.replies.length - a.replies.length) || (b.createdAt - a.createdAt);
      }
      return b.createdAt - a.createdAt;
    });

    return result;
  }, [posts, sortBy, timeWindow, query, now]);

  const isLocalGuardEnabled = () => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("anon_local_privacy_guard") !== "off"; }
    catch { return true; }
  };

  const sendPost = (text: string) => {
    if (!socket || !connected || !text || posting || text.length > MAX_POST_LENGTH) return;
    setPosting(true);
    socket.emit("confession:create", { text }, (response: MutationResponse) => {
      setPosting(false);
      if (response?.ok) {
        setDraft("");
        setStatus("Your confession is live. It will expire automatically within 7 days.");
      } else {
        setStatus(response?.error || "Could not post the confession. Please try again.");
      }
    });
  };

  const post = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!socket || !connected || !text || posting) return;
    if (text.length > MAX_POST_LENGTH) return;
    if (isLocalGuardEnabled()) {
      const findings = inspectSensitiveText(text);
      if (findings.length) {
        setPrivacyReview({ target: "post", text, findings });
        return;
      }
    }
    sendPost(text);
  };

  const reply = (confessionId: string, textOverride?: string, skipPrivacyReview = false) => {
    const text = (textOverride ?? replyText).trim();
    if (!socket || !connected || !text) return;
    if (!skipPrivacyReview && isLocalGuardEnabled()) {
      const findings = inspectSensitiveText(text);
      if (findings.length) {
        setPrivacyReview({ target: "reply", text, findings, confessionId });
        return;
      }
    }

    socket.emit("confession:reply", { confessionId, text }, (response: MutationResponse) => {
      if (response?.ok) {
        setReplyTo(null);
        setReplyText("");
        setStatus("Reply sent anonymously.");
      } else {
        setStatus(response?.error || "Could not send reply.");
      }
    });
  };

  const sendReviewedText = () => {
    if (!privacyReview) return;
    const review = privacyReview;
    setPrivacyReview(null);
    if (review.target === "post") sendPost(review.text);
    else if (review.confessionId) reply(review.confessionId, review.text, true);
  };

  const applyRedactions = () => {
    if (!privacyReview) return;
    const review = privacyReview;
    const redacted = redactSensitiveText(review.text);
    if (review.target === "post") setDraft(redacted);
    else setReplyText(redacted);
    setPrivacyReview(null);
    setStatus("Suggested redactions added locally. Review your text before sending.");
  };

  const vote = (confessionId: string, dir: 1 | -1) => {
    if (!socket || !connected) return;

    socket.emit("confession:vote", { confessionId, dir }, (response: MutationResponse) => {
      if (!response?.ok) {
        setStatus(response?.error || "Your vote could not be recorded.");
      } else {
        setStatus("");
      }
    });
  };

  const castElectionVote = (candidate: string) => {
    if (!socket || !connected) return;
    socket.emit("election:vote", { candidate }, (response: MutationResponse) => {
      if (!response?.ok) setStatus(response?.error || "Vote failed.");
      else setStatus("");
    });
  };

  return (
    <div className="confessionWrap cfStudio">
      {privacyReview && (
        <div role="dialog" aria-modal="true" aria-labelledby="cf-privacy-review-title" style={{position:"fixed",inset:0,zIndex:100000,display:"grid",placeItems:"center",padding:16,background:"rgba(3,2,4,.84)",backdropFilter:"blur(12px)"}}>
          <section style={{width:"min(100%,500px)",maxHeight:"90vh",overflowY:"auto",border:"1px solid #663046",borderRadius:18,padding:"clamp(18px,4vw,26px)",background:"linear-gradient(145deg,#140b10,#080608)",boxShadow:"0 24px 90px rgba(0,0,0,.55)",color:"#f5e9ed"}}>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:".16em",color:"#ff7f99"}}>ANON · LOCAL PRIVACY GUARD</div>
            <h3 id="cf-privacy-review-title" style={{fontSize:24,letterSpacing:"-.04em",lineHeight:1.1,margin:"12px 0 8px"}}>Check before sharing</h3>
            <p style={{fontSize:13,lineHeight:1.65,color:"#cbb7c0",margin:"0 0 14px"}}>This check runs in your browser and spotted a pattern that may identify you or expose account details. Nothing has been sent by this check.</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:13}}>
              {privacyReview.findings.map((finding) => <span key={finding} style={{fontSize:11,padding:"6px 9px",border:"1px solid #512538",borderRadius:999,color:"#ffd7e1",background:"#190a10"}}>{finding}</span>)}
            </div>
            <div style={{maxHeight:140,overflowY:"auto",overflowWrap:"anywhere",padding:12,border:"1px solid #302129",borderRadius:10,background:"#060406",color:"#c5b3bb",fontSize:12,lineHeight:1.7}}>{privacyReview.text}</div>
            <p style={{fontSize:11,lineHeight:1.6,color:"#95828b",margin:"11px 0 17px"}}>Pattern checks can miss sensitive details or flag harmless text. Suggested redactions stay in this browser until you decide what to send.</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              <button type="button" onClick={applyRedactions} style={{border:"1px solid #e14568",background:"linear-gradient(135deg,#cf234a,#82112d)",color:"#fff",borderRadius:10,padding:"11px 13px",fontSize:12,fontWeight:750,cursor:"pointer"}}>Suggest redactions</button>
              <button type="button" onClick={sendReviewedText} style={{border:"1px solid #4b3540",background:"#180f14",color:"#f1dbe3",borderRadius:10,padding:"11px 13px",fontSize:12,cursor:"pointer"}}>{privacyReview.target === "post" ? "Post as written" : "Reply as written"}</button>
              <button type="button" onClick={() => setPrivacyReview(null)} style={{border:"1px solid transparent",background:"transparent",color:"#b49da7",borderRadius:10,padding:"11px 9px",fontSize:12,cursor:"pointer"}}>Keep editing</button>
            </div>
          </section>
        </div>
      )}
      <header className="cfIntro">
        <div className="cfIntroMain">
          <div className="cfEyebrow">
            <span>ANON / THE CONFESSION WALL</span>
            <span className="cfLivePill"><i /> LIVE FEED</span>
          </div>
          <h2>Leave it here.<br /><em>Let it out.</em></h2>
          <p>A space for the thoughts you keep to yourself. No profile to build, no followers to impress — just honest words and anonymous replies.</p>
          <div className="cfIntroStats">
            <span><b>{posts.length}</b> live posts</span>
            <span className="cfStatDot">·</span>
            <span>7-day expiry</span>
            <span className="cfStatDot">·</span>
            <span>Text only</span>
          </div>
        </div>
        <aside className="cfPrivacyCard">
          <div className="cfPrivacyIcon" aria-hidden="true">⌁</div>
          <div className="cfPrivacyTitle">EPHEMERAL BY DESIGN</div>
          <p>Confessions and replies live in server memory and expire within 7 days. They are not written to a permanent confession archive.</p>
          <div className="cfPrivacyFoot">The server can read posts and replies. Reviewed reports and inactive safety records have bounded retention in this branch; deployment logs and backups are separate. Live chat is not end-to-end encrypted.</div>
        </aside>
      </header>

      {!connected && (
        <div className="cfConnectionNotice" role="status">
          <span className="cfConnectionDot" />
          Reconnecting to the live wall. Posting, voting and replies are paused until you&apos;re back online.
        </div>
      )}

      {election && (
        <section className="electionCard cfElectionCard">
          <div className="elHead">COMMUNITY ELECTION <span>·</span> {election.status === "voting" ? "VOTING OPEN" : election.status.toUpperCase()}</div>
          {election.status === "closed" && <div className="elMsg">The voting window is closed. Waiting for the next admin command.</div>}
          {election.status === "voting" && (
            <div className="elVoteBox">
              <div className="elMsg">Choose from the current top three confessions.</div>
              <div className="elCandidates">
                {posts.slice(0, 3).map((postItem) => (
                  <button
                    key={postItem.id}
                    className="elCand"
                    disabled={!connected}
                    onClick={() => castElectionVote(postItem.author)}
                  >
                    <Identicon name={postItem.author} size={26} />
                    <span>{postItem.author}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {election.status === "finished" && (
            <div className="elWinner">
              <b>{election.winner || "No votes"}</b> won the community election.
              <p>The election has ended.</p>
            </div>
          )}
        </section>
      )}

      <form className="cfComposer" onSubmit={post}>
        <div className="cfComposerTop">
          <div className="cfComposerIdentity">
            <span className="cfComposerAvatar" aria-hidden="true">✳</span>
            <div>
              <b>Send an anonymous thought</b>
              <span>Your generated ANON name is used — never a real-name field.</span>
            </div>
          </div>
          <span className="cfComposerLimit">{draft.length}/{MAX_POST_LENGTH}</span>
        </div>
        <textarea
          maxLength={MAX_POST_LENGTH}
          disabled={!connected || posting}
          placeholder={connected ? "What have you been holding in? Write it here…" : "Reconnect to write a confession"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Write an anonymous confession"
        />
        <div className="cfComposerBottom">
          <span className="cfComposerHint"><span>↳</span> Be honest. Protect your identifying details.</span>
          <button type="submit" disabled={!connected || !draft.trim() || posting}>
            <span>{posting ? "PUBLISHING…" : "POST ANONYMOUSLY"}</span>
            <b aria-hidden="true">↗</b>
          </button>
        </div>
      </form>

      {status && <p className="cfStatus" role="status" aria-live="polite">{status}</p>}

      <section className="cfFeedTools" aria-label="Feed filters">
        <div className="cfFeedTitle">
          <div>
            <span className="cfSectionEyebrow">THE COMMUNITY, IN REAL TIME</span>
            <h3>The wall <span>{visiblePosts.length}</span></h3>
          </div>
          <label className="cfSearch">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a thought…"
              aria-label="Search confessions and replies"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          </label>
        </div>

        <div className="cfControlRow">
          <div className="cfSortTabs" role="group" aria-label="Sort confessions">
            {SORT_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={"cfSortTab" + (sortBy === option.id ? " isActive" : "")}
                onClick={() => setSortBy(option.id)}
                aria-pressed={sortBy === option.id}
                title={option.detail}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="cfTimeFilters" role="group" aria-label="Filter by time">
            <span className="cfTimeLabel">POSTED</span>
            {TIME_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={"cfTimeChip" + (timeWindow === option.id ? " isActive" : "")}
                onClick={() => setTimeWindow(option.id)}
                aria-pressed={timeWindow === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="cfFeed" aria-live="polite">
        {loading && connected && (
          <div className="cfEmptyState">
            <span className="cfSpinner" />
            <b>Opening the wall…</b>
            <p>Finding the latest anonymous thoughts.</p>
          </div>
        )}

        {!loading && connected && visiblePosts.length === 0 && (
          <div className="cfEmptyState">
            <span className="cfEmptyGlyph" aria-hidden="true">∿</span>
            <b>{query ? "Nothing matches that search." : timeWindow !== "all" ? "Nothing in this time window yet." : "The wall is quiet. For now."}</b>
            <p>{query ? "Try another word or clear your search." : "Your words may be the first ones here. Share only what you're comfortable making public."}</p>
            {query && <button type="button" onClick={() => setQuery("")}>CLEAR SEARCH</button>}
          </div>
        )}

        {visiblePosts.map((postItem) => (
          <article className="cfPost" key={postItem.id}>
            <div className="cfPostTop">
              <div className="cfPostIdentity">
                <span className="cfPostAvatar"><Identicon name={postItem.author} size={32} /></span>
                <div className="cfPostByline">
                  <div className="cfAuthorLine">
                    <b>{postItem.author}</b>
                    <span className="cfAnonymousBadge">ANON</span>
                  </div>
                  <div className="cfPostMeta">
                    <span>{timeAgo(postItem.createdAt, now)}</span>
                    <span>·</span>
                    <span className="cfExpiry">{expiryText(postItem.expiresAt, now)}</span>
                  </div>
                </div>
              </div>
              <span className="cfPostMark" aria-label="Anonymous post">A/</span>
            </div>

            <p className="cfText">{postItem.text}</p>

            <div className="cfPostActions">
              <div className="cfVoteActions">
                <button
                  type="button"
                  className={"cfAction cfLikeAction" + (postItem.myVote === 1 ? " isLiked" : "")}
                  disabled={!connected || postItem.isMine}
                  onClick={() => vote(postItem.id, 1)}
                  aria-pressed={postItem.myVote === 1}
                  title={postItem.isMine ? "You cannot like your own confession" : "Like or remove your like"}
                >
                  <span className="cfHeart" aria-hidden="true">{postItem.myVote === 1 ? "♥" : "♡"}</span>
                  <span>{postItem.myVote === 1 ? "Liked" : "Like"}</span>
                  <b>{postItem.upvotes}</b>
                </button>
                <button
                  type="button"
                  className={"cfAction cfDownAction" + (postItem.myVote === -1 ? " isDown" : "")}
                  disabled={!connected || postItem.isMine}
                  onClick={() => vote(postItem.id, -1)}
                  aria-pressed={postItem.myVote === -1}
                  title="Downvote"
                >
                  <span aria-hidden="true">↓</span>
                  <b>{postItem.downvotes}</b>
                </button>
              </div>
              <button
                type="button"
                className={"cfAction cfCommentAction" + (replyTo === postItem.id ? " isOpen" : "")}
                onClick={() => {
                  setReplyTo(replyTo === postItem.id ? null : postItem.id);
                  setReplyText("");
                }}
                aria-expanded={replyTo === postItem.id}
              >
                <span aria-hidden="true">↳</span>
                <span>Comments</span>
                <b>{postItem.replies.length}</b>
              </button>
            </div>

            {postItem.replies.length > 0 && (
              <div className="cfReplies">
                <div className="cfRepliesLabel">IN THE REPLIES <span>{postItem.replies.length}</span></div>
                {postItem.replies.map((replyItem) => (
                  <div className="cfReply" key={replyItem.id}>
                    <span className="cfReplyAvatar"><Identicon name={replyItem.author} size={22} /></span>
                    <div className="cfReplyContent">
                      <div className="cfReplyByline">
                        <b>{replyItem.author}</b>
                        <span>{timeAgo(replyItem.createdAt, now)}</span>
                      </div>
                      <p>{replyItem.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {replyTo === postItem.id && (
              <form
                className="cfReplyBox"
                onSubmit={(event) => {
                  event.preventDefault();
                  reply(postItem.id);
                }}
              >
                <span className="cfReplyPrompt">↳</span>
                <input
                  maxLength={MAX_REPLY_LENGTH}
                  disabled={!connected}
                  placeholder="Add something kind, honest, or helpful…"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  aria-label="Write an anonymous reply"
                />
                <span className="cfReplyCounter">{replyText.length}/{MAX_REPLY_LENGTH}</span>
                <button type="submit" disabled={!connected || !replyText.trim()}>REPLY</button>
              </form>
            )}
          </article>
        ))}
      </div>

      <footer className="cfEndNote">
        <span aria-hidden="true">✳</span>
        <p>No follower counts. No public profiles. Just a temporary space to be heard.</p>
      </footer>
    </div>
  );
}
