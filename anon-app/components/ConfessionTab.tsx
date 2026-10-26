"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import Identicon from "@/components/Identicon";

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

export default function ConfessionTab({ socket, connected }: ConfessionTabProps) {
  const [posts, setPosts] = useState<ConfessionPost[]>([]);
  const [election, setElection] = useState<ElectionState | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!socket || !connected) return;

    const fetchList = () => socket.emit("confession:list", {}, (response: ConfessionListResponse) => {
      if (response?.ok) {
        setPosts(Array.isArray(response.confessions) ? response.confessions : []);
        setElection(response.election || null);
        setStatus("");
      } else if (response?.error) {
        setStatus(response.error);
      }
    });

    fetchList();
    socket.on("confession:update", fetchList);
    return () => {
      socket.off("confession:update", fetchList);
    };
  }, [socket, connected]);

  const post = () => {
    if (!socket || !connected || !draft.trim()) return;
    socket.emit("confession:create", { text: draft }, (response: MutationResponse) => {
      if (response?.ok) {
        setDraft("");
        setStatus("");
      } else {
        setStatus(response?.error || "Could not post the confession.");
      }
    });
  };

  const reply = (id: string) => {
    if (!socket || !connected || !replyText.trim()) return;
    socket.emit("confession:reply", { confessionId: id, text: replyText }, (response: MutationResponse) => {
      if (response?.ok) {
        setReplyTo(null);
        setReplyText("");
        setStatus("");
      } else {
        setStatus(response?.error || "Could not send reply.");
      }
    });
  };

  const vote = (confessionId: string, dir: 1 | -1) => {
    if (!socket || !connected) return;
    socket.emit("confession:vote", { confessionId, dir }, (response: MutationResponse) => {
      if (!response?.ok) setStatus(response?.error || "Vote failed.");
      else setStatus("");
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
    <div className="confessionWrap">
      {election && (
        <div className={`electionCard ${election.status}`}>
          <div className="elHead">ELECTION WINDOW</div>
          {election.status === "closed" && <div className="elMsg">The window is closed. Awaiting Admin command.</div>}
          {election.status === "voting" && (
            <div className="elVoteBox">
              <div className="elMsg">VOTE FOR YOUR LEADER</div>
              <div className="elCandidates">
                {posts.slice(0, 3).map((postItem) => (
                  <button
                    key={postItem.id}
                    className="elCand"
                    disabled={!connected}
                    onClick={() => castElectionVote(postItem.author)}
                  >
                    <Identicon name={postItem.author} size={30} />
                    <span>{postItem.author}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {election.status === "finished" && (
            <div className="elWinner">
              👑 <b>{election.winner || "No votes"}</b> HAS WON.
              <p>The election has ended.</p>
            </div>
          )}
        </div>
      )}

      <div className="cfComposer">
        <textarea
          maxLength={1000}
          disabled={!connected}
          placeholder={connected ? "Confess something... (up to 7 days)" : "Connect to post"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button disabled={!connected || !draft.trim()} onClick={post}>POST</button>
      </div>
      {status && <p role="status" aria-live="polite">{status}</p>}

      <div className="cfFeed">
        {posts.map((postItem) => (
          <div className="cfPost" key={postItem.id}>
            <div className="cfHead">
              <Identicon name={postItem.author} size={20} />
              <b>{postItem.author}</b>
            </div>
            <div className="cfText">{postItem.text}</div>

            <div className="cfActions">
              <button disabled={!connected} onClick={() => vote(postItem.id, 1)}>▲ {postItem.upvotes}</button>
              <button disabled={!connected} onClick={() => vote(postItem.id, -1)}>▼ {postItem.downvotes}</button>
              <button onClick={() => setReplyTo(replyTo === postItem.id ? null : postItem.id)}>💬 Reply</button>
            </div>

            {postItem.replies.length > 0 && (
              <div className="cfReplies">
                {postItem.replies.map((replyItem) => (
                  <div className="cfReply" key={replyItem.id}>
                    <Identicon name={replyItem.author} size={14} /> <b>{replyItem.author}</b>: {replyItem.text}
                  </div>
                ))}
              </div>
            )}

            {replyTo === postItem.id && (
              <div className="cfReplyBox">
                <input
                  autoFocus
                  maxLength={400}
                  placeholder="Reply..."
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") reply(postItem.id);
                  }}
                />
                <button disabled={!connected || !replyText.trim()} onClick={() => reply(postItem.id)}>Send</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
