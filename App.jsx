import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW = 10;

export default function App() {
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [windowSeconds, setWindowSeconds] = useState(DEFAULT_WINDOW);
  const [logs, setLogs] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [notice, setNotice] = useState("");

  // Keep the visualization moving and expire old requests in real time.
  useEffect(() => {
    const ticker = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      setLogs((previous) =>
        previous.filter((entry) => current - entry.time < windowSeconds * 1000)
      );
      if (blockedUntil && current >= blockedUntil) {
        setBlockedUntil(0);
        setNotice("Rate limit reset. You can send requests again.");
      }
    }, 100);
    return () => window.clearInterval(ticker);
  }, [windowSeconds, blockedUntil]);

  const activeLogs = useMemo(
    () => logs.filter((entry) => now - entry.time < windowSeconds * 1000),
    [logs, now, windowSeconds]
  );

  const isBlocked = blockedUntil > now;
  const remaining = isBlocked ? Math.ceil((blockedUntil - now) / 1000) : 0;
  const capacity = Math.min(100, Math.round((activeLogs.length / limit) * 100));

  function sendRequest() {
    if (paused) return;
    if (blockedUntil > Date.now()) {
      setNotice(`HTTP 429: Rate limit exceeded. Retry in ${remaining}s.`);
      return;
    }

    if (activeLogs.length >= limit) {
      // Keep the lockout until the oldest active request leaves the window.
      const oldest = [...activeLogs].sort((a, b) => a.time - b.time)[0];
      const resetAt = oldest ? oldest.time + windowSeconds * 1000 : Date.now() + 1000;
      setBlockedUntil(resetAt);
      setNotice("HTTP 429: Rate limit exceeded.");
      return;
    }

    const entry = { id: `${Date.now()}-${Math.random()}`, time: Date.now() };
    setLogs((previous) => [...previous, entry]);
    setNow(Date.now());
    setNotice("Request accepted · 200 OK");
  }

  function resetExperiment() {
    setLogs([]);
    setBlockedUntil(0);
    setNotice("Experiment reset.");
    setNow(Date.now());
  }

  // Map the trailing time window into the SVG plot.
  const plot = { x: 34, y: 24, width: 620, height: 184 };
  const leftEdge = now - windowSeconds * 1000;
  const xForTime = (time) =>
    plot.x + ((time - leftEdge) / (windowSeconds * 1000)) * plot.width;
  const visibleLogs = activeLogs.map((entry) => ({
    ...entry,
    x: Math.max(plot.x, Math.min(plot.x + plot.width, xForTime(entry.time))),
  }));

  return (
    <main className="rate-app">
      <header className="topbar">
        <div>
          <h1>Sliding Window <span>Log Algorithm</span></h1>
        </div>
      </header>

      <section className="instrument">
        <div className="chart-head">
          <div>
            <div className="section-kicker">LIVE TIMELINE</div>
            <div className="chart-title">Request log window</div>
          </div>
          <button className="round-button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume animation" : "Pause animation"}>
            {paused ? "▶" : "Ⅱ"}
          </button>
        </div>

        <div className="chart-wrap">
          <svg className="timeline" viewBox="0 0 700 280" role="img" aria-label="Sliding request window with timestamp markers">
            <defs>
              <pattern id="grid" width="140" height="70" patternUnits="userSpaceOnUse">
                <path d="M 140 0 L 0 0 0 70" fill="none" stroke="#3a3d45" strokeWidth="1" strokeDasharray="4 5" />
              </pattern>
              <linearGradient id="windowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3567f6" stopOpacity=".16" />
                <stop offset="100%" stopColor="#3567f6" stopOpacity=".05" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="700" height="280" fill="url(#grid)" />
            <line x1="0" y1="140" x2="700" y2="140" stroke="#50535d" strokeWidth="2" />
            <rect x={plot.x} y={plot.y + 22} width={plot.width} height="164" fill="url(#windowFill)" stroke="#3674ff" strokeWidth="1.5" strokeDasharray="2 3" />
            <text x={plot.x + 8} y={plot.y + 44} fill="#4b82ff" fontSize="10" fontFamily="monospace">−{windowSeconds}s window boundary</text>
            <text x={plot.x + plot.width - 8} y={plot.y + 44} textAnchor="end" fill="#4b82ff" fontSize="10" fontFamily="monospace">NOW</text>
            <line x1={plot.x + plot.width} y1="20" x2={plot.x + plot.width} y2="205" stroke="#ff493f" strokeWidth="2" />
            <circle cx={plot.x + plot.width} cy="20" r="4" fill="#ff493f" />
            {visibleLogs.map((entry, index) => (
              <g key={entry.id}>
                <line x1={entry.x} y1="62" x2={entry.x} y2="140" stroke="#4b82ff" strokeWidth="1.5" opacity=".75" />
                <circle cx={entry.x} cy="140" r="5" fill="#4b82ff" stroke="#b8ccff" strokeWidth="1.5" />
                <text x={entry.x} y={index % 2 === 0 ? 52 : 172} textAnchor="middle" fill="#dbe5ff" fontSize="9" fontFamily="monospace">#{index + 1}</text>
              </g>
            ))}
            <text x="16" y="246" fill="#87909f" fontSize="11">← Sliding log history</text>
            <text x="684" y="246" textAnchor="end" fill="#87909f" fontSize="11">Time continue →</text>
            <text x="16" y="266" fill="#596171" fontSize="9" fontFamily="monospace">T−{windowSeconds}s</text>
            <text x="684" y="266" textAnchor="end" fill="#596171" fontSize="9" fontFamily="monospace">T+0 · LIVE</text>
          </svg>
        </div>

        <div className="metrics">
          <div className="metric">
            <span>LOGS IN WINDOW</span>
            <strong>{activeLogs.length} <i>/ {limit}</i></strong>
          </div>
          <div className="metric">
            <span>WINDOW CAPACITY</span>
            <strong>{capacity}%</strong>
            <div className="capacity-track"><span style={{ width: `${capacity}%` }} /></div>
          </div>
          <div className="metric">
            <span>ALGORITHM TRACK</span>
            <strong className="blue-text">Sliding Log</strong>
          </div>
        </div>

        <div className="controls">
          <div className="slider-control">
            <label htmlFor="limit">Max requests constraint</label>
            <div className="slider-line">
              <input id="limit" type="range" min="1" max="12" value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
              <b>{limit} reqs</b>
            </div>
          </div>
          <div className="slider-control">
            <label htmlFor="duration">Sliding window duration</label>
            <div className="slider-line">
              <input id="duration" type="range" min="3" max="30" value={windowSeconds} onChange={(event) => setWindowSeconds(Number(event.target.value))} />
              <b>{windowSeconds}s span</b>
            </div>
          </div>
        </div>

        <div className="actions">
          <button className="send-button" onClick={sendRequest} disabled={paused || isBlocked}>
            {isBlocked ? `HTTP 429 · Retry in ${remaining}s` : "Trigger inbound request log"}
          </button>
          <button className="reset-button" onClick={resetExperiment}>Reset</button>
        </div>

        <div className={`notice ${isBlocked ? "notice-error" : ""}`} aria-live="polite">
          <span className="notice-light" />
          {notice || "Ready · Send requests to populate the sliding window."}
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel">
          <div className="section-kicker">EVENT REGISTRY</div>
          <h2>Recent request timestamps</h2>
          {activeLogs.length === 0 ? (
            <p className="empty-state">No active logs. New requests will appear here.</p>
          ) : (
            <div className="log-list">
              {[...activeLogs].reverse().map((entry) => (
                <div className="log-row" key={entry.id}>
                  <span className="log-icon">↗</span>
                  <div><b>REQUEST_ACCEPTED</b><small>{new Date(entry.time).toLocaleTimeString()}</small></div>
                  <code>{Math.floor(entry.time / 1000)}</code>
                  <span className="ok-label">200 OK</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel explanation">
          <div className="section-kicker">PROTOCOL STATUS</div>
          <h2>{isBlocked ? "Rate limit engaged" : "Sliding log algorithm"}</h2>
          <p>{isBlocked
            ? `The request limit was reached. The oldest active log expires in about ${remaining} second(s), then requests can resume.`
            : `Each accepted request adds a timestamp. Timestamps older than ${windowSeconds} seconds expire automatically, freeing capacity for the next request.`}</p>
          <div className="rule"><span>Limit</span><b>{limit} requests</b></div>
          <div className="rule"><span>Time window</span><b>{windowSeconds} seconds</b></div>
          <div className="rule"><span>Current state</span><b className={isBlocked ? "red-text" : "green-text"}>{isBlocked ? "429 THROTTLED" : "200 READY"}</b></div>
        </div>
      </section>
    </main>
  );
}
