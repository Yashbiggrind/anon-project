"use client";
import { useEffect, useState } from "react";
import Identicon from "@/components/Identicon";

export default function ConfessionTab({ socket, identity, connected }: { socket: any, identity: any, connected: boolean }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [election, setElection] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (!socket) return;
    const fetchList = () => socket.emit("confession:list", {}, (res: any) => {
      if (res?.ok) { setPosts(res.confessions); setElection(res.election); }
    });
    fetchList();
    socket.on("confession:update", fetchList);
    return () => socket.off("confession:update", fetchList);
  }, [socket, connected]);

  const post = () => {
    if (!draft.trim()) return;
    socket.emit("confession:create", { text: draft, author: identity?.username || "anon" }, () => setDraft(""));
  };

  const reply = (id: string) => {
    if (!replyText.trim()) return;
    socket.emit("confession:reply", { confessionId: id, text: replyText, author: identity?.username || "anon" }, () => {
      setReplyTo(null); setReplyText("");
    });
  };

  return (
    <div className="confessionWrap">
      {/* ELECTION WINDOW */}
      {election && (
        <div className={`electionCard ${election.status}`}>
          <div className="elHead">ELECTION WINDOW</div>
          {election.status === "closed" && <div className="elMsg">The window is closed. Awaiting Admin command.</div>}
          {election.status === "voting" && (
            <div className="elVoteBox">
              <div className="elMsg">VOTE FOR YOUR LEADER</div>
              <div className="elCandidates">
                {posts.slice(0,3).map((p:any, i:number) => (
                  <button key={i} className="elCand" onClick={() => socket.emit("election:vote", { candidate: p.author })}>
                    <Identicon name={p.author} size={30} />
                    <span>{p.author}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {election.status === "finished" && (
            <div className="elWinner">
              👑 <b>{election.winner}</b> HAS WON.
              <p>The new World Builder has been granted supreme power.</p>
            </div>
          )}
        </div>
      )}

      {/* COMPOSER */}
      <div className="cfComposer">
        <textarea placeholder="Confess something... (lives for 7 days)" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button onClick={post}>POST</button>
      </div>

      {/* FEED */}
      <div className="cfFeed">
        {posts.map((p) => (
          <div className="cfPost" key={p.id}>
            <div className="cfHead">
              <Identicon name={p.author} size={20} />
              <b>{p.author}</b>
            </div>
            <div className="cfText">{p.text}</div>
            
            <div className="cfActions">
              <button onClick={() => socket.emit("confession:vote", { confessionId: p.id, dir: 1 })}>▲ {p.upvotes}</button>
              <button onClick={() => socket.emit("confession:vote", { confessionId: p.id, dir: -1 })}>▼ {p.downvotes}</button>
              <button onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}>💬 Reply</button>
            </div>

            {p.replies?.length > 0 && (
              <div className="cfReplies">
                {p.replies.map((r:any) => (
                  <div className="cfReply" key={r.id}>
                    <Identicon name={r.author} size={14} /> <b>{r.author}</b>: {r.text}
                  </div>
                ))}
              </div>
            )}

            {replyTo === p.id && (
              <div className="cfReplyBox">
                <input autoFocus placeholder="Reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reply(p.id)} />
                <button onClick={() => reply(p.id)}>Send</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}