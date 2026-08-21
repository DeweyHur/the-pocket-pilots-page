"use client";

import { useEffect, useMemo, useState } from "react";

type Member = {
  name: string;
  role: string;
};

type Song = {
  title: string;
  link: string;
};

type Rehearsal = {
  date: string;
  time: string;
  location: string;
  payLink: string;
};

type BandPlan = {
  members: Member[];
  songs: Song[];
  rehearsal: Rehearsal;
};

type SheetRow = Record<string, string>;

const SHEET_ID = "1hb3RNe1QZRfb22GG2IQVEV09-EK4v_VQbiydUPR3FPQ";
const SHEET_GID = "0";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}#gid=${SHEET_GID}`;
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const SHEET_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;

const FALLBACK_PLAN: BandPlan = {
  members: [
    { name: "Lee", role: "Guitar" },
    { name: "Dewey", role: "Bass" },
    { name: "Harry", role: "Drums" },
  ],
  songs: [
    {
      title: "Fox Chick and a Cool Cat",
      link: "https://www.youtube.com/watch?v=dr82--SKbDU",
    },
    {
      title: "Song for My Father",
      link: "https://www.youtube.com/watch?v=04yz-nhz3ZU",
    },
    {
      title: "Lift Off",
      link: "https://www.youtube.com/watch?v=O7GaK516Wkk",
    },
    {
      title: "Chank",
      link: "https://www.youtube.com/watch?v=81CnBzABteQ",
    },
  ],
  rehearsal: {
    date: "September 1, 2026",
    time: "8:00–10:00 PM",
    location: "422 S Western Ave, Los Angeles, CA 90020",
    payLink:
      "https://venmo.com/joonpark80?txn=pay&amount=20&note=Meetup%20entry",
  },
};

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseCsv(csv: string): SheetRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(normalize);
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function parseGviz(text: string): SheetRow[] {
  try {
    const responseStart = text.indexOf("setResponse(");
    const jsonStart = text.indexOf("{", responseStart);
    const jsonEnd = text.lastIndexOf(")");
    if (responseStart < 0 || jsonStart < 0 || jsonEnd <= jsonStart) return [];

    const payload = JSON.parse(text.slice(jsonStart, jsonEnd));
    const columns = payload.table?.cols ?? [];
    const headers = columns.map((column: { id?: string; label?: string }, index: number) =>
      normalize(column.label || column.id || `column${index + 1}`),
    );

    return (payload.table?.rows ?? []).map((row: { c?: Array<{ v?: unknown } | null> }) =>
      Object.fromEntries(
        headers.map((header: string, index: number) => [header, String(row.c?.[index]?.v ?? "")]),
      ),
    );
  } catch {
    return [];
  }
}

function first(row: SheetRow | undefined, ...keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[normalize(key)];
    if (value) return value.trim();
  }
  return "";
}

function planFromRows(rows: SheetRow[]): BandPlan | null {
  const members = rows
    .filter((row) => {
      const type = normalize(first(row, "type", "section", "category"));
      return type === "member" || type === "band member" || type === "lineup";
    })
    .map((row) => ({
      name: first(row, "name", "member", "player"),
      role: first(row, "role", "instrument", "part"),
    }))
    .filter((member) => member.name && member.role);

  const songs = rows
    .filter((row) => {
      const type = normalize(first(row, "type", "section", "category"));
      return type === "song" || type === "setlist" || type === "track";
    })
    .map((row) => ({
      title: first(row, "title", "song", "name"),
      link: first(row, "link", "url", "youtube", "reference"),
    }))
    .filter((song) => song.title && song.link);

  const eventRow = rows.find((row) => {
    const type = normalize(first(row, "type", "section", "category"));
    return type === "event" || type === "rehearsal" || type === "details";
  });

  const sheetSettings = rows.find((row) => {
    const type = normalize(first(row, "type", "section", "category"));
    return type === "settings" || type === "setting" || type === "meta";
  });

  if (!members.length && !songs.length && !eventRow) return null;

  return {
    members: members.length ? members : FALLBACK_PLAN.members,
    songs: songs.length ? songs : FALLBACK_PLAN.songs,
    rehearsal: {
      date: first(eventRow, "date", "rehearsal date") || FALLBACK_PLAN.rehearsal.date,
      time: first(eventRow, "time", "hours") || FALLBACK_PLAN.rehearsal.time,
      location:
        first(eventRow, "location", "address", "venue") || FALLBACK_PLAN.rehearsal.location,
      payLink:
        first(eventRow, "pay link", "payment", "venmo", "paylink") ||
        first(sheetSettings, "pay link", "payment", "venmo", "paylink") ||
        FALLBACK_PLAN.rehearsal.payLink,
    },
  };
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.valueOf())) return { month: "SEP", day: "01" };
  return {
    month: parsed.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
  };
}

function mapLink(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

async function fetchSheetRows(signal: AbortSignal) {
  const csvResponse = await fetch(SHEET_CSV_URL, { signal });
  if (!csvResponse.ok) throw new Error(`CSV export returned ${csvResponse.status}`);
  const csvRows = parseCsv(await csvResponse.text());
  if (csvRows.length) return csvRows;

  try {
    const gvizResponse = await fetch(SHEET_GVIZ_URL, { signal });
    if (gvizResponse.ok) {
      const gvizRows = parseGviz(await gvizResponse.text());
      if (gvizRows.length) return gvizRows;
    }
  } catch {
    // The CSV export is the primary public endpoint; gviz is best-effort.
  }

  return [];
}

export default function Home() {
  const [plan, setPlan] = useState(FALLBACK_PLAN);
  const [syncState, setSyncState] = useState<"syncing" | "live" | "empty" | "unavailable">("syncing");
  const dateParts = useMemo(() => formatDate(plan.rehearsal.date), [plan.rehearsal.date]);

  useEffect(() => {
    const controller = new AbortController();

    fetchSheetRows(controller.signal)
      .then((rows) => {
        const nextPlan = planFromRows(rows);
        if (nextPlan) {
          setPlan(nextPlan);
          setSyncState("live");
        } else {
          setSyncState("empty");
        }
      })
      .catch(() => setSyncState("unavailable"));

    return () => controller.abort();
  }, []);

  return (
    <main className="site-shell">
      <header className="topbar page-width">
        <a className="brand" href="#top" aria-label="The Pocket Pilots home">
          <span className="brand-mark">PP</span>
          <span>
            <strong>The Pocket Pilots</strong>
            <small>Rehearsal HQ</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#lineup">Lineup</a>
          <a href="#setlist">Setlist</a>
          <a href="#details">Details</a>
        </nav>
        <a className="topbar-cta" href={SHEET_URL} target="_blank" rel="noreferrer">
          Open sheet <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div id="top" className="page-width hero-grid">
        <section className="hero-copy" aria-labelledby="hero-title">
          <p className="eyebrow"><span className="live-dot" /> Los Angeles · next session</p>
          <h1 id="hero-title">Lock in.<br /><em>Lift off.</em></h1>
          <p className="hero-intro">
            The quick reference for our next room. Three players, four songs, one loud evening.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#setlist">See the setlist <span aria-hidden="true">↓</span></a>
            <a className="text-link" href={mapLink(plan.rehearsal.location)} target="_blank" rel="noreferrer">
              Get directions <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <aside className="date-card" aria-label="Next rehearsal">
          <div className="card-stamp">NEXT RUN-THROUGH <span>●</span></div>
          <div className="date-lockup">
            <span className="date-month">{dateParts.month}</span>
            <strong>{dateParts.day}</strong>
          </div>
          <div className="date-rule" />
          <p>{plan.rehearsal.date}</p>
          <p className="date-time">{plan.rehearsal.time}</p>
          <a className="card-arrow" href="#details" aria-label="See rehearsal details">↘</a>
        </aside>
      </div>

      <section id="lineup" className="section page-width" aria-labelledby="lineup-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / The crew</p>
            <h2 id="lineup-title">Players on deck</h2>
          </div>
          <p className="section-note">Keep the pocket tight.<br />Let the room breathe.</p>
        </div>
        <div className="members-grid">
          {plan.members.map((member, index) => (
            <article className="member-card" key={`${member.name}-${member.role}`}>
              <span className="card-index">0{index + 1}</span>
              <div className="member-initial" aria-hidden="true">{member.name.slice(0, 1)}</div>
              <div className="member-info">
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </div>
              <span className="member-line" />
            </article>
          ))}
        </div>
      </section>

      <section id="setlist" className="setlist-section" aria-labelledby="setlist-title">
        <div className="page-width">
          <div className="section-heading setlist-heading">
            <div>
              <p className="eyebrow">02 / In rotation</p>
              <h2 id="setlist-title">Songs to bring alive</h2>
            </div>
            <span className="count-badge">{String(plan.songs.length).padStart(2, "0")} tracks</span>
          </div>
          <div className="songs-list">
            {plan.songs.map((song, index) => (
              <article className="song-row" key={song.title}>
                <span className="song-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{song.title}</h3>
                <span className="song-type">Reference track</span>
                <a className="song-link" href={song.link} target="_blank" rel="noreferrer" aria-label={`Watch ${song.title} on YouTube`}>
                  <span>Watch</span><span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="details" className="section details-section page-width" aria-labelledby="details-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">03 / The brief</p>
            <h2 id="details-title">Know before you go</h2>
          </div>
        </div>
        <div className="details-grid">
          <article className="detail-card detail-card-main">
            <span className="detail-label">Where</span>
            <h3>Rehearsal room</h3>
            <p>{plan.rehearsal.location}</p>
            <a className="detail-action" href={mapLink(plan.rehearsal.location)} target="_blank" rel="noreferrer">Open in Maps <span aria-hidden="true">↗</span></a>
          </article>
          <article className="detail-card">
            <span className="detail-label">When</span>
            <h3>{plan.rehearsal.date}</h3>
            <p>{plan.rehearsal.time}</p>
          </article>
          <article className="detail-card payment-card">
            <span className="detail-label">Entry</span>
            <h3>$20</h3>
            <p>Send your room fee before we tune up.</p>
            <a className="button button-dark" href={plan.rehearsal.payLink} target="_blank" rel="noreferrer">Pay via Venmo <span aria-hidden="true">↗</span></a>
          </article>
        </div>
      </section>

      <section className="sheet-section page-width" aria-labelledby="sheet-title">
        <div className="sheet-icon" aria-hidden="true">↳</div>
        <div>
          <p className="eyebrow">The source of truth</p>
          <h2 id="sheet-title">Managed in Google Sheets</h2>
          <p>Edit the shared sheet to keep the lineup, setlist, and rehearsal details current.</p>
        </div>
        <div className={`sync-status sync-${syncState}`}>
          <span className="status-dot" />
          {syncState === "live"
            ? "Live sync"
            : syncState === "syncing"
              ? "Checking sheet"
              : syncState === "empty"
                ? "Sheet is empty"
                : "Using saved plan"}
        </div>
        <a className="button button-light" href={SHEET_URL} target="_blank" rel="noreferrer">Edit the sheet <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="footer page-width">
        <span>The Pocket Pilots / rehearsal notes</span>
        <span>Los Angeles, CA</span>
        <span>Made for the pocket.</span>
      </footer>
    </main>
  );
}
