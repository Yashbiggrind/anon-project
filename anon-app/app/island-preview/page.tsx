"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Player = {
  id: number;
  num: number;
  name: string;
  faction: "Idealist" | "Militant" | "Independent";
  votes: number;
  isUser: boolean;
};

export default function IslandPreview() {
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [clock, setClock] = useState({ timeLeft: 900, isVotingOpen: true });
  const [log, setLog] = useState<string[]>(["System Initialized. Waiting for votes..."]);
  
  // Initialize 4 players (1 User, 3 Bots)
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, num: 537, name: "YOU", faction: "Independent", votes: 0, isUser: true },
    { id: 2, num: 12, name: "SILENT_WOLF", faction: "Idealist", votes: 0, isUser: false },
    { id: 3, num: 34, name: "VELVET_CROW", faction: "Militant", votes: 0, isUser: false },
    { id: 4, num: 78, name: "GHOST_LYNX", faction: "Independent", votes: 0, isUser: false }
  ]);

  // Keep countdown and voting status in one state update to avoid nested state writes.
  useEffect(() => {
    if (!clock.isVotingOpen) return;
    const timer = setInterval(() => {
      setClock((current) => {
        if (!current.isVotingOpen) return current;
        if (current.timeLeft <= 1) {
          return { timeLeft: 0, isVotingOpen: false };
        }
        return { ...current, timeLeft: current.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [clock.isVotingOpen]);

  // Announce the winner after voting has closed, using the final current tally.
  useEffect(() => {
    if (clock.isVotingOpen) return;
    const winner = players.reduce((max, player) => player.votes > max.votes ? player : max, players[0]);
    const timer = window.setTimeout(() => {
      const announcement = `👑 ELECTION CLOSED. ${winner.name} (#${winner.num}) WINS.`;
      setLog((current) => current.includes(announcement) ? current : [...current, announcement]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clock.isVotingOpen, players]);

  // Bots vote randomly every three seconds; no state updates happen inside a state updater.
  useEffect(() => {
    if (!clock.isVotingOpen) return;
    const timer = setInterval(() => {
      const voters = players.filter((player) => !player.isUser);
      if (voters.length === 0) return;
      const voter = voters[Math.floor(Math.random() * voters.length)];
      const targets = players.filter((player) => player.id !== voter.id);
      if (targets.length === 0 || Math.random() <= 0.4) return;
      const target = targets[Math.floor(Math.random() * targets.length)];
      setLog((current) => [...current.slice(-4), `🗳️ ${voter.name} voted for ${target.name}`]);
      setPlayers((current) => current.map((player) =>
        player.id === target.id ? { ...player, votes: player.votes + 1 } : player
      ));
    }, 3000);
    return () => clearInterval(timer);
  }, [clock.isVotingOpen, players]);

  const castVote = (targetId: number) => {
    if (!clock.isVotingOpen) return;
    const target = players.find((player) => player.id === targetId);
    if (!target) return;
    setPlayers((current) => current.map((player) =>
      player.id === targetId ? { ...player, votes: player.votes + 1 } : player
    ));
    setLog((current) => [...current.slice(-4), `👤 YOU voted for ${target.name}`]);
  };

  const formatTime = (sec: number) => `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2, '0')}`;

  return (
    <div className="island-root">
      <style>{ISLAND_CSS}</style>
      
      {/* 3D GRID FLOOR */}
      <div className="island-floor"><div className="grid-lines"></div></div>

      {/* HEADER */}
      <header className="island-header">
        <div className="logo">THE BEACH // ELECTION PROTOCOL</div>
        <div className="header-actions">
          <button className="owner-toggle" onClick={() => setIsOwnerView(!isOwnerView)}>
            {isOwnerView ? "👁️ DISABLE OWNER HUD" : "👑 OWNER HUD"}
          </button>
          <Link href="/" className="exit-btn">EXIT TO REALITY</Link>
        </div>
      </header>

      {/* MAIN 3D ARENA */}
      <div className="island-arena">
        
        {/* LEFT: SYSTEM LOG */}
        <div className="hud-panel log-panel">
          <div className="panel-title">SYSTEM LOG</div>
          <div className="log-content">
            {log.map((l, i) => <div key={i} className="log-line">{l}</div>)}
          </div>
        </div>

        {/* CENTER: PLAYERS (3D FLOATING CARDS) */}
        <div className="player-zone">
          {players.map((p, i) => (
            <div key={p.id} className={`player-card-3d ${p.isUser ? 'is-user' : ''}`} style={{ left: `${10 + i * 25}%` }}>
              <div className="card-top">
                <span className="p-num">#{p.num}</span>
                <span className={`p-faction ${p.faction.toLowerCase()}`}>{p.faction}</span>
              </div>
              <div className="p-name">{p.name}</div>
              <div className="p-votes">
                <span className="v-label">VOTES</span>
                <span className="v-count">{p.votes}</span>
              </div>
              {clock.isVotingOpen && !p.isUser && (
                <button className="vote-btn" onClick={() => castVote(p.id)}>VOTE</button>
              )}
              {!clock.isVotingOpen && p.votes === Math.max(...players.map(x => x.votes)) && (
                <div className="winner-crown">👑 WINNER</div>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT: OWNER HUD (ONLY VISIBLE IF TOGGLED) */}
        {isOwnerView && (
          <div className="hud-panel owner-panel">
            <div className="panel-title" style={{ color: '#ff2d55' }}>OWNER OVERRIDE</div>
            <div className="owner-stats">
              <p>Phase: <span>ELECTION</span></p>
              <p>Time Left: <span style={{ color: '#00ffcc' }}>{formatTime(clock.timeLeft)}</span></p>
              <p>Total Players: <span>{players.length}</span></p>
              <p>Status: <span>{clock.isVotingOpen ? 'LIVE' : 'LOCKED'}</span></p>
            </div>
            <button className="owner-btn" onClick={() => setClock((current) => ({ ...current, isVotingOpen: false }))}>
              FORCE END ELECTION
            </button>
            <button className="owner-btn danger" onClick={() => window.location.reload()}>
              RESET ISLAND
            </button>
          </div>
        )}

      </div>
      
      {/* TIMER OVERLAY */}
      <div className="global-timer">
        <div className="timer-label">TIME UNTIL CLOSURE</div>
        <div className="timer-clock">{formatTime(clock.timeLeft)}</div>
      </div>
    </div>
  );
}

const ISLAND_CSS = `
  .island-root { height: 100vh; background: #020202; color: #fff; font-family: 'Courier New', monospace; overflow: hidden; position: relative; display: flex; flex-direction: column; }
  
  /* 3D FLOOR */
  .island-floor { position: absolute; width: 200%; height: 200%; bottom: -50%; left: -50%; transform: rotateX(75deg); background: radial-gradient(circle, rgba(0,20,20,1) 0%, rgba(0,0,0,1) 70%); border-top: 2px solid rgba(0, 255, 204, 0.2); }
  .grid-lines { width: 100%; height: 100%; background-image: linear-gradient(rgba(0,255,204,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.05) 1px, transparent 1px); background-size: 40px 40px; animation: gridMove 5s linear infinite; }
  @keyframes gridMove { from { background-position: 0 0; } to { background-position: 0 40px; } }

  /* HEADER */
  .island-header { position: relative; z-index: 10; display: flex; justify-content: space-between; padding: 20px 40px; border-bottom: 1px solid rgba(0, 255, 204, 0.2); background: rgba(0,0,0,0.8); }
  .logo { font-size: 1.2rem; font-weight: bold; color: #00ffcc; letter-spacing: 3px; text-shadow: 0 0 10px rgba(0, 255, 204, 0.5); }
  .header-actions { display: flex; gap: 15px; }
  .owner-toggle, .exit-btn { background: transparent; border: 1px solid #ff2d55; color: #ff2d55; padding: 5px 15px; font-family: inherit; font-size: 0.8rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
  .owner-toggle:hover, .exit-btn:hover { background: #ff2d55; color: #000; box-shadow: 0 0 15px rgba(255, 45, 85, 0.5); }

  /* MAIN ARENA */
  .island-arena { position: relative; z-index: 10; flex: 1; display: flex; justify-content: space-between; padding: 40px; perspective: 1000px; }
  
  /* HUD PANELS */
  .hud-panel { width: 280px; background: rgba(0, 10, 10, 0.85); border: 1px solid rgba(0, 255, 204, 0.3); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; box-shadow: 0 0 30px rgba(0, 255, 204, 0.1); backdrop-filter: blur(5px); }
  .panel-title { font-size: 0.9rem; color: #00ffcc; letter-spacing: 2px; border-bottom: 1px dashed rgba(0, 255, 204, 0.3); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; }
  
  .log-panel { align-self: flex-start; height: 300px; }
  .log-content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
  .log-line { font-size: 0.75rem; color: #888; line-height: 1.4; }

  .owner-panel { align-self: flex-start; height: auto; border-color: #ff2d55; box-shadow: 0 0 30px rgba(255, 45, 85, 0.15); }
  .owner-stats p { display: flex; justify-content: space-between; font-size: 0.8rem; color: #aaa; margin-bottom: 10px; }
  .owner-btn { background: rgba(255, 45, 85, 0.1); border: 1px solid #ff2d55; color: #ff2d55; padding: 10px; margin-top: 10px; font-family: inherit; cursor: pointer; text-transform: uppercase; font-size: 0.75rem; transition: all 0.2s; }
  .owner-btn:hover { background: #ff2d55; color: #000; }
  .owner-btn.danger { background: transparent; border-color: #ff2d55; margin-top: 10px; }

  /* PLAYER CARDS (3D) */
  .player-zone { position: relative; flex: 1; transform-style: preserve-3d; }
  .player-card-3d { position: absolute; bottom: 50px; width: 200px; background: rgba(5, 15, 15, 0.9); border: 1px solid #333; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; align-items: center; transform: rotateX(10deg); transition: all 0.3s; animation: float 4s ease-in-out infinite; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
  .player-card-3d:nth-child(2) { animation-delay: 1s; }
  .player-card-3d:nth-child(3) { animation-delay: 2s; }
  .player-card-3d:nth-child(4) { animation-delay: 3s; }
  @keyframes float { 0%, 100% { transform: translateY(0) rotateX(10deg); } 50% { transform: translateY(-15px) rotateX(10deg); } }
  
  .player-card-3d.is-user { border-color: #00ffcc; box-shadow: 0 0 30px rgba(0, 255, 204, 0.2); }
  
  .card-top { width: 100%; display: flex; justify-content: space-between; margin-bottom: 15px; }
  .p-num { font-size: 1.2rem; font-weight: bold; color: #ff2d55; }
  .p-faction { font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: bold; }
  .p-faction.idealist { background: rgba(0, 255, 204, 0.1); color: #00ffcc; border: 1px solid #00ffcc; }
  .p-faction.militant { background: rgba(255, 45, 85, 0.1); color: #ff2d55; border: 1px solid #ff2d55; }
  .p-faction.independent { background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid #888; }
  
  .p-name { font-size: 1.1rem; font-weight: bold; letter-spacing: 1px; margin-bottom: 20px; }
  
  .p-votes { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
  .v-label { font-size: 0.6rem; color: #555; letter-spacing: 2px; }
  .v-count { font-size: 2rem; font-weight: 900; color: #fff; }
  
  .vote-btn { width: 100%; padding: 10px; background: transparent; border: 1px solid #444; color: #fff; font-family: inherit; cursor: pointer; transition: all 0.2s; }
  .vote-btn:hover { background: #00ffcc; color: #000; border-color: #00ffcc; box-shadow: 0 0 20px rgba(0, 255, 204, 0.4); }
  
  .winner-crown { margin-top: 10px; color: #ffd700; font-weight: bold; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); animation: pulse 1.5s infinite; }

  /* GLOBAL TIMER */
  .global-timer { position: absolute; top: 100px; left: 50%; transform: translateX(-50%); z-index: 20; text-align: center; background: rgba(0,0,0,0.8); padding: 15px 40px; border: 1px solid #ff2d55; border-radius: 10px; box-shadow: 0 0 40px rgba(255, 45, 85, 0.3); }
  .timer-label { font-size: 0.7rem; color: #aaa; letter-spacing: 2px; margin-bottom: 5px; }
  .timer-clock { font-size: 2.5rem; font-weight: bold; color: #ff2d55; text-shadow: 0 0 20px rgba(255, 45, 85, 0.8); letter-spacing: 2px; }
`;