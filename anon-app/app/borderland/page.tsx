"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Phase = "portal" | "visa" | "game1" | "game2" | "game3" | "gameover";

export default function Borderland() {
  const [phase, setPhase] = useState<Phase>("portal");
  const [playerNum, setPlayerNum] = useState(0);
  const [timer, setTimer] = useState(900); // 15 minutes
  const [gameTimer, setGameTimer] = useState(10); 
  const [logs, setLogs] = useState<string[]>([]);
  const [clues, setClues] = useState<string[]>([]);
  const [winner, setWinner] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  
  // Hardcoded bots for the live event
  const [players, setPlayers] = useState([
    { id: 1, name: "You", alive: true, isTraitor: false, action: "Waiting...", score: 0, votes: 0 },
    { id: 2, name: "Bot_Alpha", alive: true, isTraitor: false, action: "Observing...", score: 0, votes: 0 },
    { id: 3, name: "Bot_Beta", alive: true, isTraitor: false, action: "Standing still...", score: 0, votes: 0 },
    { id: 4, name: "Bot_Gamma", alive: true, isTraitor: false, action: "Sweating...", score: 0, votes: 0 }
  ]);

  const log = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);

  useEffect(() => {
    if (phase === "portal" || phase === "visa" || phase === "gameover") return;
    const t = setInterval(() => setTimer((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // GAME 1: VOTING
  useEffect(() => {
    if (phase !== "game1") return;
    setGameTimer(15);
    setHasVoted(false);
    log("Host: Vote for the weakest link. 15 seconds.");
    
    const t = setInterval(() => {
      setGameTimer((p) => {
        if (p <= 1) {
          clearInterval(t);
          setPlayers(prev => {
            const alive = prev.filter(p => p.alive);
            const maxVotes = Math.max(...alive.map(p => p.votes));
            const toDie = alive.filter(p => p.votes === maxVotes);
            const victim = toDie.find(p => p.name === "You") || toDie[0];
            log("💥 " + victim.name + " was voted out.");
            const updated = prev.map(p => p.id === victim.id ? { ...p, alive: false, action: "VOTED OUT" } : p);
            if (victim.name === "You") setTimeout(() => { setWinner("The Bots"); setPhase("gameover"); }, 2000);
            else setTimeout(() => { setPhase("game2"); setGameTimer(60); }, 3000);
            return updated;
          });
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // GAME 2: 60 SECOND SPAM
  useEffect(() => {
    if (phase !== "game2") return;
    setGameTimer(60);
    log("Host: Spam for 60 seconds. Lowest score dies.");
    
    const botSpam = setInterval(() => {
      setPlayers(prev => prev.map(p => p.name !== "You" && p.alive && Math.random() > 0.2 ? { ...p, score: p.score + 1, action: "Spamming!" } : p));
    }, 300);

    const t = setInterval(() => {
      setGameTimer((p) => {
        if (p <= 1) {
          clearInterval(t); clearInterval(botSpam);
          setPlayers(prev => {
            const alive = prev.filter(p => p.alive);
            const lowest = alive.reduce((min, p) => p.score < min.score ? p : min, alive[0]);
            const updated = prev.map(p => p.id === lowest.id ? { ...p, alive: false, action: "SHOT (Lowest Spam)" } : { ...p, score: 0, action: "Waiting..." });
            log("💥 " + lowest.name + " had the lowest score and was eliminated.");
            if (!updated.find(p => p.name === "You")?.alive) setTimeout(() => { setWinner("The Bots"); setPhase("gameover"); }, 2000);
            else setTimeout(() => {
              const aliveBots = updated.filter(p => p.name !== "You" && p.alive);
              const traitor = aliveBots[Math.floor(Math.random() * aliveBots.length)];
              setPlayers(updated.map(p => p.id === traitor.id ? { ...p, isTraitor: true } : p));
              setPhase("game3");
            }, 3000);
            return updated;
          });
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => { clearInterval(t); clearInterval(botSpam); };
  }, [phase]);

  // GAME 3: TRAITOR
  useEffect(() => {
    if (phase !== "game3") return;
    log("Host: One of you is a traitor. Find them.");
    const traitor = players.find(p => p.isTraitor && p.alive);
    if (!traitor) return;

    const attackTimer = setTimeout(() => {
      setPlayers(prev => {
        const aliveTargets = prev.filter(p => !p.isTraitor && p.alive);
        if (aliveTargets.length === 0) return prev;
        const victim = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
        const updated = prev.map(p => p.id === victim.id ? { ...p, alive: false, action: "STABBED IN THE DARK" } : p);
        log("🩸 " + victim.name + " was murdered.");
        setClues(prev => [...prev, "Clue: A trail of dark pixels leads to the bottom right corner."]);
        if (victim.name === "You") setTimeout(() => { setWinner("The Traitor"); setPhase("gameover"); }, 2000);
        return updated;
      });
    }, 6000);
    return () => clearTimeout(attackTimer);
  }, [phase, players]);

  const spamClick = () => {
    if (gameTimer <= 0 || !players.find(p => p.name === "You")?.alive) return;
    setPlayers(prev => prev.map(p => p.name === "You" ? { ...p, score: p.score + 1, action: "Spamming!" } : p));
  };

  const vote = (targetId: number) => {
    if (hasVoted || phase !== "game1") return;
    setHasVoted(true);
    setPlayers(prev => prev.map(p => p.id === targetId ? { ...p, votes: p.votes + 1 } : p));
    setTimeout(() => {
      setPlayers(prev => prev.map(p => p.alive && Math.random() > 0.5 ? { ...p, votes: p.votes + 1 } : p));
    }, 1500);
  };

  const accuse = (targetId: number) => {
    if (phase !== "game3") return;
    const target = players.find(p => p.id === targetId);
    if (target?.isTraitor) { log("🎯 Correct! " + target?.name + " was the Traitor."); setWinner("You"); }
    else { log("❌ Wrong! " + target?.name + " was innocent."); setWinner("The Traitor"); }
    setTimeout(() => setPhase("gameover"), 3000);
  };

  const formatTime = (sec: number) => `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2, '0')}`;

  if (phase === "portal") return (
    <div className="bl-portal"><style>{BL_CSS}</style><div className="bl-glitch-text">THE BORDERLAND</div><p>15 minutes. Only one survives.</p><button className="bl-enter-btn" onClick={() => { setPlayerNum(Math.floor(Math.random()*999)+1); setPhase("visa"); }}>ENTER THE PORTAL</button></div>
  );

  if (phase === "visa") return (
    <div className="bl-visa-bg"><style>{BL_CSS}</style><div className="bl-visa-card"><div className="bl-visa-chip"></div><div className="bl-visa-header">BORDERLAND VISA</div><div className="bl-visa-number">#{playerNum.toString().padStart(3, '0')}</div><div className="bl-visa-timer"><span>TIME UNTIL CLOSURE</span>{formatTime(timer)}</div><div className="bl-visa-barcode">|||| |||| ||| |||| |||| ||</div></div><button className="bl-enter-btn" onClick={() => setPhase("game1")}>ENTER THE ARENA</button></div>
  );

  if (phase === "gameover") return (
    <div className="bl-gameover"><style>{BL_CSS}</style><h1>SURVIVAL OVER</h1><h2>WINNER: {winner}</h2><div className="logs-box">{logs.map((l, i) => <p key={i}>{l}</p>)}</div><Link href="/" className="bl-enter-btn">RETURN TO REALITY</Link></div>
  );

  return (
    <div className={`bl-game-bg ${phase === "game3" ? "parallel-universe" : ""}`}>
      <style>{BL_CSS}</style>
      <div className="arena-container">
        <div className="arena-floor"><div className="grid-lines"></div></div>
        <div className="arena-players">
          {players.map((p, i) => (
            <div key={p.id} className={`player-3d ${p.alive ? 'alive' : 'dead'}`} style={{ left: `${15 + i * 22}%` }}>
              <div className="player-card">
                <div className="card-glow" style={{ background: !p.alive ? '#333' : phase === 'game3' ? '#ff0000' : '#00ffcc' }}></div>
                <h2>{p.name}</h2>
                <div className="status-text">{p.action}</div>
                {phase === "game1" && p.alive && <div className="vote-count">Votes: {p.votes}</div>}
                {phase === "game2" && <div className="score-text">Score: {p.score}</div>}
                {!p.alive && <div className="dead-overlay">TERMINATED</div>}
              </div>
              <div className="player-shadow"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="game-ui">
        <div className="game-header">
          <h1>{phase === "game1" ? "GAME 1: THE WEAKEST LINK" : phase === "game2" ? "GAME 2: SPAM SURVIVAL" : "GAME 3: THE TRAITOR"}</h1>
          <div className="timer-pill">{phase === "game1" || phase === "game2" ? `${gameTimer}s` : formatTime(timer)}</div>
        </div>
        <div className="live-log">{logs.map((l, i) => <div key={i}>{l}</div>)}</div>
        {phase === "game1" && players.find(p => p.name === "You")?.alive && (
          <div className="instruction-box">
            <p>VOTE TO ELIMINATE SOMEONE</p>
            <div className="action-buttons">
              {players.filter(p => p.alive && p.name !== "You").map(p => (
                <button key={p.id} className="vote-btn" onClick={() => vote(p.id)} disabled={hasVoted}>VOTE {p.name}</button>
              ))}
            </div>
          </div>
        )}
        {phase === "game2" && players.find(p => p.name === "You")?.alive && (
          <div className="instruction-box"><button className="spam-btn" onClick={spamClick}>[ SPAM ]</button></div>
        )}
        {phase === "game3" && players.find(p => p.name === "You")?.alive && (
          <div className="instruction-box traitor-box">
            <p className="survivor-text">FIND THE TRAITOR</p>
            <div className="action-buttons">
              {players.filter(p => p.alive && p.name !== "You").map(p => (
                <button key={p.id} className="accuse-btn" onClick={() => accuse(p.id)}>ACCUSE {p.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {phase === "game3" && (
        <div className="clue-panel"><h3>CLUES</h3>{clues.length === 0 ? <p>No clues yet...</p> : clues.map((c, i) => <p key={i} className="clue-text">{c}</p>)}</div>
      )}
    </div>
  );
}

const BL_CSS = `
.bl-portal{height:100vh;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace}.bl-glitch-text{font-size:4rem;font-weight:900;color:#ff2d55;animation:glitch 1s infinite;margin-bottom:20px;letter-spacing:10px}.bl-enter-btn{padding:15px 40px;background:transparent;border:2px solid #ff2d55;color:#ff2d55;font-size:1.2rem;cursor:pointer;transition:all .3s;margin-top:30px;text-transform:uppercase;font-weight:bold}.bl-enter-btn:hover{background:#ff2d55;color:#000;box-shadow:0 0 50px #ff2d55}@keyframes glitch{0%{text-shadow:3px 0 red,-3px 0 blue}50%{text-shadow:-3px 0 red,3px 0 blue}100%{text-shadow:3px 0 red,-3px 0 blue}}
.bl-visa-bg{height:100vh;background:#050505;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;perspective:1000px}.bl-visa-card{width:450px;height:280px;background:linear-gradient(135deg,#1a1a1a,#000);border:1px solid #444;border-radius:15px;padding:30px;color:#fff;position:relative;box-shadow:0 30px 60px rgba(0,0,0,.9),0 0 20px rgba(255,45,85,.2);display:flex;flex-direction:column;justify-content:space-between;transform:rotateY(-15deg) rotateX(5deg);transition:transform .4s}.bl-visa-card:hover{transform:rotateY(0) rotateX(0);box-shadow:0 30px 60px rgba(0,0,0,.9),0 0 40px rgba(255,45,85,.5)}.bl-visa-chip{width:60px;height:45px;background:linear-gradient(90deg,#d4af37,#ffdf00,#d4af37);border-radius:5px;box-shadow:inset 0 0 5px rgba(0,0,0,.5)}.bl-visa-header{color:#888;font-size:.9rem;letter-spacing:4px}.bl-visa-number{font-size:3.5rem;font-weight:900;letter-spacing:8px;color:#ff2d55;text-shadow:0 0 10px rgba(255,45,85,.8)}.bl-visa-timer{display:flex;flex-direction:column;font-size:1.5rem;font-weight:bold;color:#fff}.bl-visa-timer span{font-size:.7rem;color:#555;letter-spacing:2px;margin-bottom:5px}.bl-visa-barcode{font-family:monospace;font-size:2rem;letter-spacing:3px;opacity:.3}
.bl-game-bg{height:100vh;background:#020202;color:#fff;font-family:'Courier New',monospace;overflow:hidden;display:flex;justify-content:center;align-items:center;perspective:1000px}.bl-game-bg.parallel-universe{background:#000;filter:grayscale(100%) contrast(150%)}.arena-container{position:relative;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center}.arena-floor{position:absolute;width:150%;height:150%;bottom:-30%;transform:rotateX(75deg);background:radial-gradient(circle,rgba(20,20,20,1) 0%,rgba(0,0,0,1) 70%);display:flex;justify-content:center;align-items:center;border-top:2px solid #333}.grid-lines{width:100%;height:100%;background-image:linear-gradient(rgba(255,45,85,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,45,85,.1) 1px,transparent 1px);background-size:50px 50px;animation:gridMove 5s linear infinite}@keyframes gridMove{from{background-position:0 0}to{background-position:0 50px}}.arena-players{position:relative;width:1100px;height:400px;transform-style:preserve-3d;display:flex;justify-content:center;transform:rotateX(15deg)}.player-3d{position:absolute;bottom:0;transform-style:preserve-3d;animation:float 3s ease-in-out infinite;display:flex;flex-direction:column;align-items:center;transition:all .5s}.player-3d:nth-child(2){animation-delay:.5s}.player-3d:nth-child(3){animation-delay:1s}.player-3d:nth-child(4){animation-delay:1.5s}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}.player-card{width:180px;height:250px;background:rgba(10,10,10,.9);border:1px solid #444;border-radius:10px;padding:15px;text-align:center;position:relative;box-shadow:0 20px 40px rgba(0,0,0,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(5px)}.card-glow{position:absolute;top:0;left:0;right:0;height:4px;border-radius:10px 10px 0 0;transition:background .3s}.player-card h2{font-size:1.2rem;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}.status-text{font-size:.8rem;color:#888}.vote-count{font-size:1.2rem;color:#ff2d55;font-weight:bold;margin-top:10px}.score-text{font-size:1.5rem;color:#fff;font-weight:bold;margin-top:10px}.player-shadow{width:100px;height:10px;background:rgba(0,0,0,.8);border-radius:50%;margin-top:20px;filter:blur(4px);transition:all .3s}.player-3d.dead{opacity:.3;filter:grayscale(100%);animation:none;transform:translateY(20px)}.player-3d.dead .player-shadow{width:150px;filter:blur(8px)}.dead-overlay{position:absolute;top:40%;left:0;right:0;background:#f00;color:#000;font-weight:bold;padding:5px;transform:rotate(-15deg)}.game-ui{position:absolute;top:0;left:0;width:100%;padding:30px;pointer-events:none;display:flex;flex-direction:column;align-items:center;z-index:10}.game-header{display:flex;justify-content:space-between;width:100%;max-width:1200px;border-bottom:1px solid #333;padding-bottom:15px}.game-header h1{font-size:1.5rem;color:#ff2d55;letter-spacing:2px;text-shadow:0 0 10px rgba(255,45,85,.5)}.timer-pill{background:#000;border:1px solid #ff2d55;color:#ff2d55;padding:5px 15px;border-radius:20px;font-weight:bold;font-size:1.2rem}.live-log{margin-top:10px;font-size:.9rem;color:#888;text-align:center;height:60px;width:100%}.live-log div{margin-bottom:3px}.instruction-box{margin-top:20px;background:rgba(0,0,0,.8);border:1px solid #333;padding:20px 40px;border-radius:10px;text-align:center;pointer-events:auto;backdrop-filter:blur(5px)}.instruction-box p{font-size:1.1rem;color:#aaa;margin-bottom:15px}.action-buttons{display:flex;gap:15px;margin-top:15px}.vote-btn{background:#200;border:1px solid #ff2d55;color:#ff2d55;padding:10px 20px;cursor:pointer;font-family:inherit;font-weight:bold;text-transform:uppercase}.vote-btn:hover{background:#ff2d55;color:#000}.spam-btn{background:#ff2d55;color:#000;border:none;padding:20px 60px;font-size:1.5rem;font-weight:bold;cursor:pointer;border-radius:8px;user-select:none;transition:transform .1s;box-shadow:0 0 30px rgba(255,45,85,.5)}.spam-btn:active{transform:scale(.9)}.traitor-box{border-color:#ff0000;box-shadow:0 0 40px rgba(255,0,0,.2)}.survivor-text{color:#00ffcc!important;font-weight:bold}.accuse-btn{background:#111;border:1px solid #555;color:#fff;padding:10px 20px;cursor:pointer;font-family:inherit;font-weight:bold}.accuse-btn:hover{border-color:#f00;color:#f00;box-shadow:0 0 10px rgba(255,0,0,.5)}.clue-panel{position:absolute;bottom:20px;left:20px;width:300px;background:rgba(0,0,0,.85);border:1px solid #333;border-radius:10px;padding:15px;z-index:10}.clue-panel h3{color:#ff2d55;margin-bottom:10px;border-bottom:1px solid #333;padding-bottom:5px}.clue-text{color:#aaa;font-style:italic;margin-bottom:8px;font-size:.9rem}.bl-gameover{height:100vh;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;text-align:center}.bl-gameover h1{font-size:4rem;color:#ff2d55;margin-bottom:10px;letter-spacing:5px}.bl-gameover h2{font-size:2rem;color:#fff;margin-bottom:40px}.logs-box{background:#111;padding:20px;border:1px solid #333;border-radius:10px;color:#888;width:500px;margin-bottom:30px}
`;
