
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./App.css";
const STORAGE_KEY = "urlshortener:data:v1";
const LOG_KEY = "urlshortener:logs:v1";
function nowIso() {
  return new Date().toISOString();
}
function parseInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
function isValidShortcode(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{4,12}$/.test(trimmed);
}
function generateShortcode(length = 6) {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
}
function appendLog(entry) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({ ts: nowIso(), ...entry });
    while (list.length > 200) list.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(list));
  } catch {
return false;
  }
}
function readState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { links: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { links: {} };
  }
}
function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function recordClick(shortcode, ctx = {}) {
  const state = readState();
  const link = state.links && state.links[shortcode];
  if (!link) return null;
  const clickRecord = {
    ts: nowIso(),
    source: ctx.source || document.referrer || "direct",
    location: ctx.location || "Unknown",
  };
  link.clicks.push(clickRecord);
  link.clickCount = (link.clickCount || 0) + 1;
  writeState(state);
  appendLog({ level: "info", op: "recordClick", shortcode, clickCount: link.clickCount });
  return clickRecord;
}
async function createShortLink({ longUrl, preferredShortcode, validityMinutes }) {
  const state = readState();
  if (!state.links) state.links = {};

  let shortcode = preferredShortcode ? preferredShortcode.trim() : null;
  if (shortcode) {
    if (state.links[shortcode]) {
      appendLog({ level: "warn", op: "createShortLink", shortcode, reason: "taken" });
      throw new Error("Preferred shortcode already taken");
    }
  } else {
    let attempts = 0;
    do {
      shortcode = generateShortcode(attempts > 20 ? 8 : 6);
      attempts++;
      if (attempts > 100) throw new Error("Could not generate unique shortcode");
    } while (state.links[shortcode]);
  }

  const createdAt = nowIso();
  const minutes = parseInteger(validityMinutes);
  const finalMinutes = minutes && minutes > 0 ? minutes : 30;
  const expiry = new Date(Date.now() + finalMinutes * 60_000).toISOString();

  state.links[shortcode] = {
    shortcode,
    longUrl,
    createdAt,
    expiry,
    validityMinutes: finalMinutes,
    clicks: [],
    clickCount: 0,
  };

  writeState(state);
  appendLog({ level: "info", op: "createShortLink", shortcode, validityMinutes: finalMinutes });
  return state.links[shortcode];
}

function getAllLinks() {
  const state = readState();
  const list = Object.values(state.links || {});
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function getLink(shortcode) {
  const state = readState();
  return (state.links && state.links[shortcode]) || null;
}
function Header() {
  return (
    <header className="header">
      <div className="container">
        <h1 className="brand">URL Shortener</h1>
        <nav className="nav">
          <Link to="/">Shorten</Link>
          <Link to="/stats">Statistics</Link>
        </nav>
      </div>
    </header>
  );
}
function ShortenerPage() {
  const [rows, setRows] = useState([{ id: 1, longUrl: "", minutes: "", shortcode: "" }]);
  const [recent, setRecent] = useState([]);
  const maxRows = 5;

  useEffect(() => {
    setRecent(getAllLinks().slice(0, 10));
  }, []);

  function addRow() {
    setRows((prev) =>
      prev.length >= maxRows ? prev : [...prev, { id: Date.now(), longUrl: "", minutes: "", shortcode: "" }]
    );
  }
  function updateRow(id, key, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }
  function removeRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const created = [];
    for (const r of rows) {
      if (!r.longUrl || !r.longUrl.trim()) continue;
      if (!isValidUrl(r.longUrl.trim())) {
        appendLog({ level: "warn", op: "validation", field: "longUrl", value: r.longUrl });
        continue;
      }
      const minutes = parseInteger(r.minutes);
      const preferred = r.shortcode && r.shortcode.trim() ? r.shortcode.trim() : undefined;
      if (preferred && !isValidShortcode(preferred)) {
        appendLog({ level: "warn", op: "validation", field: "shortcode", value: preferred });
        continue;
      }
      try {
        const link = await createShortLink({
          longUrl: r.longUrl.trim(),
          preferredShortcode: preferred,
          validityMinutes: minutes,
        });
        created.push(link);
      } catch (err) {
        appendLog({ level: "error", op: "create", error: err.message || String(err) });
      }
    }
    setRecent(getAllLinks().slice(0, 20));
    setRows([{ id: Date.now(), longUrl: "", minutes: "", shortcode: "" }]);
    if (created.length > 0) {
      appendLog({ level: "info", op: "createdBatch", count: created.length });
    }
  }

  return (
    <main className="page container">
      <h2>Shorten up to 5 URLs</h2>

      <form onSubmit={handleSubmit} className="form">
        {rows.map((r, idx) => (
          <div className="row" key={r.id}>
            <input
              placeholder={`Original URL #${idx + 1}`}
              value={r.longUrl}
              onChange={(e) => updateRow(r.id, "longUrl", e.target.value)}
              aria-label={`Original URL ${idx + 1}`}
            />
            <input
              placeholder="Validity (minutes)"
              value={r.minutes}
              onChange={(e) => updateRow(r.id, "minutes", e.target.value)}
            />
            <input
              placeholder="Preferred shortcode (optional)"
              value={r.shortcode}
              onChange={(e) => updateRow(r.id, "shortcode", e.target.value)}
            />
            <button type="button" className="btn-danger" onClick={() => removeRow(r.id)} aria-label="Remove row">
              Remove
            </button>
          </div>
        ))}

        <div className="actions">
          <button type="button" onClick={addRow} disabled={rows.length >= maxRows} className="btn">
            Add row
          </button>
          <button type="submit" className="btn primary">
            Create Short Links
          </button>
        </div>
      </form>

      <section className="recent">
        <h3>Recent shortened links</h3>
        {recent.length === 0 ? (
          <p>No links yet.</p>
        ) : (
          <ul className="list">
            {recent.map((link) => (
              <li key={link.shortcode} className="list-item">
                <div className="list-row">
                  <div>
                    <strong>Short URL:</strong>{" "}
                    <a href={`/r/${link.shortcode}`}>{window.location.origin}/r/{link.shortcode}</a>
                  </div>
                  <div className="meta">
                    <small>Created: {new Date(link.createdAt).toLocaleString()}</small>
                    <small>Expires: {new Date(link.expiry).toLocaleString()}</small>
                    <div>Clicks: {link.clickCount || 0}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
function StatsPage() {
  const [links, setLinks] = useState([]);
  useEffect(() => setLinks(getAllLinks()), []);

  return (
    <main className="page container">
      <h2>Shortened URL Statistics</h2>

      {links.length === 0 ? (
        <p>No shortened URLs yet.</p>
      ) : (
        links.map((link) => (
          <article key={link.shortcode} className="card">
            <div className="card-head">
              <a href={`/r/${link.shortcode}`}>{window.location.origin}/r/{link.shortcode}</a>
              <div className="meta">
                <small>Created: {new Date(link.createdAt).toLocaleString()}</small>
                <small>Expiry: {new Date(link.expiry).toLocaleString()}</small>
                <div>Clicks: {link.clickCount || 0}</div>
              </div>
            </div>

            <details className="click-details">
              <summary>Click details ({(link.clicks || []).length})</summary>
              <ul>
                {(link.clicks || []).map((c, i) => (
                  <li key={i}>
                    {new Date(c.ts).toLocaleString()} — {c.source || "direct"} — {c.location || "Unknown"}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))
      )}
    </main>
  );
}
function RedirectHandler() {
  const { shortcode } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const link = getLink(shortcode);
      if (!link) {
        navigate("/stats");
        return;
      }
      if (new Date() > new Date(link.expiry)) {
        navigate("/stats");
        return;
      }
      let location = "Unknown";
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 900);
        const resp = await fetch("https://ipapi.co/json/", { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) {
          const body = await resp.json();
          location = [body.country_name, body.region, body.city].filter(Boolean).join(", ") || "Unknown";
        }
      } catch {
        // ignore - location stays Unknown
      }
      recordClick(shortcode, { source: document.referrer || "direct", location }).catch(() => {});
      if (!cancelled) {
        try {
          window.location.replace(link.longUrl);
        } catch {
          navigate("/stats");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shortcode, navigate]);

  return (
    <main className="page container">
      <h2>Redirecting…</h2>
      <p>If you are not redirected automatically, go to <Link to="/stats">Statistics</Link>.</p>
    </main>
  );
}
export default function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<ShortenerPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/r/:shortcode" element={<RedirectHandler />} />
        <Route
          path="*"
          element={
            <main className="page container">
              Not found — <Link to="/">Go home</Link>
            </main>
          }
        />
      </Routes>
    </Router>
  );
}




