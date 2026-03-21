import { useState, useEffect, useCallback, useRef } from "react";

// ─── Persistence ──────────────────────────────────────────────────────────────
const DB_KEY = "lingo_decks_v2";
const load = () => { try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch { return []; } };
const save = (decks) => localStorage.setItem(DB_KEY, JSON.stringify(decks));

// ─── Utils ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const normalize = (s) =>
    s.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/['']/g, "'");

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const exportCSV = (deck) => {
    const rows = [["Français", "Turc"], ...deck.cards.map(c => [c.fr, c.tr])];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${deck.name.replace(/\s+/g, "_")}.csv`;
    a.click();
};

const parseCSV = (text) => {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    const parseRow = (line) => {
        const cols = []; let cur = ""; let inQ = false;
        for (const ch of line) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
            else { cur += ch; }
        }
        cols.push(cur.trim());
        return cols.map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
    };
    const rows = lines.map(parseRow);
    const first = rows[0]?.[0]?.toLowerCase() || "";
    const start = (first === "français" || first === "francais" || first === "french") ? 1 : 0;
    const cards = rows.slice(start).filter(r => r[0] && r[1]).map(r => ({ id: uid(), fr: r[0], tr: r[1] }));
    if (cards.length === 0) throw new Error("Aucun mot trouvé dans le CSV");
    return cards;
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --red:        #C8102E;
    --red-deep:   #9e0d24;
    --red-light:  #e8203f;
    --red-bg:     rgba(200,16,46,0.10);
    --red-bg2:    rgba(200,16,46,0.18);
    --bg:         #0f0608;
    --bg2:        #180b0e;
    --bg3:        #221016;
    --surface:    #2c1419;
    --border:     rgba(200,16,46,0.13);
    --border2:    rgba(200,16,46,0.24);
    --text:       #f5eeee;
    --text2:      #b89898;
    --text3:      #7a5555;
    --green:      #4ecb82;
    --green-bg:   rgba(78,203,130,0.1);
    --radius:     10px;
    --radius-lg:  16px;
    --font:       'Inter', sans-serif;
    --font-serif: 'Playfair Display', serif;
    --shadow:     0 4px 20px rgba(0,0,0,0.55);
    --shadow-lg:  0 8px 48px rgba(0,0,0,0.75);
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100vh; }

  /* ── Layout ── */
  .app { display: flex; min-height: 100vh; }
  .sidebar {
    width: 228px; flex-shrink: 0; background: var(--bg2);
    border-right: 1px solid var(--border); display: flex; flex-direction: column;
    padding: 0 0 20px; position: fixed; height: 100vh; z-index: 10;
  }
  .main { margin-left: 228px; flex: 1; padding: 36px; max-width: 1080px; }

  /* ── Sidebar header ── */
  .sidebar-header {
    padding: 20px 18px 18px;
    background: var(--red);
    border-bottom: 3px solid var(--red-deep);
    position: relative; overflow: hidden;
  }
  .sidebar-header::before {
    content: '';
    position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
    width: 64px; height: 64px;
    border-radius: 50%;
    border: 14px solid rgba(255,255,255,0.12);
    pointer-events: none;
  }
  .sidebar-header::after {
    content: '★';
    position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
    font-size: 14px; color: rgba(255,255,255,0.22);
    pointer-events: none;
  }
  .logo { font-family: var(--font-serif); font-size: 19px; color: #fff; font-weight: 700; letter-spacing: -0.2px; }
  .logo-sub { color: rgba(255,255,255,0.55); font-size: 10.5px; margin-top: 3px; letter-spacing: 0.8px; text-transform: uppercase; }

  /* ── Nav ── */
  .nav { padding: 12px 8px; flex: 1; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    border-radius: var(--radius); cursor: pointer; color: var(--text2);
    font-size: 13.5px; font-weight: 500; transition: all .15s; margin-bottom: 2px;
    border: none; background: none; width: 100%; text-align: left; font-family: var(--font);
  }
  .nav-item:hover { background: var(--surface); color: var(--text); }
  .nav-item.active { background: var(--red-bg2); color: #f8b0bb; }
  .nav-icon { font-size: 15px; width: 20px; }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 18px; border-radius: var(--radius); font-size: 13.5px;
    font-weight: 500; cursor: pointer; border: none; transition: all .15s;
    font-family: var(--font); white-space: nowrap;
  }
  .btn-primary { background: var(--red); color: #fff; }
  .btn-primary:hover { background: var(--red-light); }
  .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border2); }
  .btn-ghost:hover { background: var(--surface); color: var(--text); }
  .btn-danger { background: var(--red-bg); color: #f8b0bb; border: 1px solid rgba(200,16,46,0.25); }
  .btn-danger:hover { background: var(--red-bg2); }
  .btn-green { background: var(--green-bg); color: var(--green); border: 1px solid rgba(78,203,130,0.2); }
  .btn-sm { padding: 5px 11px; font-size: 12px; }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .w-full { width: 100%; justify-content: center; }

  /* ── Card ── */
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; }

  /* ── Forms ── */
  input, textarea, select {
    background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius);
    color: var(--text); font-family: var(--font); font-size: 14px;
    padding: 10px 14px; width: 100%; outline: none; transition: border-color .15s;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--red); }
  input::placeholder { color: var(--text3); }
  label {
    display: block; font-size: 10.5px; color: var(--text2);
    margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .field { margin-bottom: 16px; }
  .error-msg { color: #f8b0bb; font-size: 12px; margin-top: 6px; }

  /* ── Page headers ── */
  .page-title { font-family: var(--font-serif); font-size: 26px; margin-bottom: 4px; font-weight: 700; }
  .page-sub { color: var(--text2); font-size: 13px; margin-bottom: 26px; }
  .section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; gap: 12px; }

  /* ── Deck grid ── */
  .deck-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: 13px; }
  .deck-card {
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 20px; cursor: pointer; transition: all .2s; position: relative; overflow: hidden;
  }
  .deck-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--red); opacity: 0; transition: opacity .2s;
  }
  .deck-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: var(--shadow); }
  .deck-card:hover::before { opacity: 1; }
  .deck-name { font-size: 15px; font-weight: 600; margin-bottom: 5px; line-height: 1.3; padding-right: 0; }
  .deck-meta { font-size: 11.5px; color: var(--text3); }
  .deck-badge {
    position: absolute; top: 15px; right: 13px;
    background: var(--red-bg); color: #f8b0bb;
    font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px;
    border: 1px solid rgba(200,16,46,0.2);
  }
  .deck-actions { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; }

  /* ── Flashcard ── */
  .flashcard-scene { perspective: 1000px; width: 300px; height: 182px; cursor: pointer; flex-shrink: 0; }
  .flashcard-inner {
    width: 100%; height: 100%; position: relative;
    transform-style: preserve-3d; transition: transform 0.5s cubic-bezier(0.4,0,0.2,1);
  }
  .flashcard-inner.flipped { transform: rotateY(180deg); }
  .flashcard-face {
    position: absolute; width: 100%; height: 100%;
    backface-visibility: hidden; border-radius: var(--radius-lg);
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;
    border: 1px solid var(--border2);
  }
  .flashcard-front { background: var(--bg2); }
  .flashcard-back {
    background: var(--red); border-color: var(--red-deep);
    transform: rotateY(180deg); position: relative; overflow: hidden;
  }
  .flashcard-back::before {
    content: '';
    position: absolute; right: -18px; top: -18px;
    width: 80px; height: 80px; border-radius: 50%;
    border: 18px solid rgba(255,255,255,0.1);
    pointer-events: none;
  }
  .flashcard-back .card-word { color: #fff; }
  .flashcard-back .card-lang { color: rgba(255,255,255,0.55); }
  .flashcard-back .card-hint { color: rgba(255,255,255,0.35); }
  .card-word { font-family: var(--font-serif); font-size: 22px; text-align: center; font-weight: 700; }
  .card-hint { font-size: 10px; color: var(--text3); margin-top: 8px; }
  .card-lang { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin-bottom: 8px; }
  .cards-row { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 18px; }

  /* ── Words table ── */
  .words-table { width: 100%; border-collapse: collapse; }
  .words-table th { text-align: left; font-size: 10.5px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text3); padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .words-table td { padding: 10px 12px; font-size: 13.5px; border-bottom: 1px solid var(--border); }
  .words-table tr:last-child td { border-bottom: none; }
  .words-table tr:hover td { background: var(--surface); }
  .word-row { cursor: default; }
  .word-row:hover td { background: var(--surface); }
  .editing-row td { background: var(--bg3) !important; padding: 6px 8px; }
  .editing-row input { padding: 6px 10px; font-size: 13px; }
  .add-row { display: flex; gap: 8px; margin-top: 12px; }
  .add-row input { flex: 1; }

  /* ── Dropdown ── */
  .dropdown-wrap { position: relative; display: inline-block; }
  .dropdown-menu {
    position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
    background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius);
    box-shadow: var(--shadow-lg); min-width: 190px; overflow: hidden;
  }
  .dropdown-section { padding: 5px 0; }
  .dropdown-label { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text3); padding: 5px 14px 2px; }
  .dropdown-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 14px; font-size: 13px; color: var(--text2); background: none; border: none; cursor: pointer; text-align: left; font-family: var(--font); transition: all .1s; }
  .dropdown-item:hover { background: var(--surface); color: var(--text); }
  .dropdown-divider { height: 1px; background: var(--border); margin: 2px 0; }
  .import-label { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 14px; font-size: 13px; color: var(--text2); cursor: pointer; transition: all .1s; text-transform: none; letter-spacing: 0; font-weight: 400; margin-bottom: 0; }
  .import-label:hover { background: var(--surface); color: var(--text); }
  .import-label input[type=file] { display: none; }

  /* ── Modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius-lg); padding: 28px; width: 400px; max-width: 92vw; box-shadow: var(--shadow-lg); }
  .modal-title { font-family: var(--font-serif); font-size: 20px; margin-bottom: 20px; font-weight: 700; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

  /* ── Toast ── */
  .toast { position: fixed; bottom: 22px; right: 22px; z-index: 1000; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius); padding: 11px 16px; font-size: 13.5px; box-shadow: var(--shadow-lg); animation: slideUp .22s ease; }
  .toast.success { border-left: 3px solid var(--green); }
  .toast.error { border-left: 3px solid var(--red-light); }
  @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* ── Quiz ── */
  .quiz-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 36px; text-align: center; max-width: 460px; margin: 0 auto; }
  .quiz-word { font-family: var(--font-serif); font-size: 32px; margin: 16px 0; font-weight: 700; }
  .quiz-lang-badge { display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; background: var(--red-bg); color: #f8b0bb; border: 1px solid rgba(200,16,46,0.2); }
  .quiz-input { text-align: center; font-size: 18px; margin: 18px 0; padding: 13px; }
  .quiz-result { font-size: 20px; font-weight: 700; margin: 10px 0; }
  .quiz-result.correct { color: var(--green); }
  .quiz-result.wrong { color: #f8b0bb; }
  .quiz-progress { display: flex; gap: 4px; justify-content: center; margin-bottom: 18px; flex-wrap: wrap; }
  .quiz-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border2); flex-shrink: 0; }
  .quiz-dot.done-correct { background: var(--green); }
  .quiz-dot.done-wrong { background: var(--red-light); }
  .quiz-dot.current { background: var(--red); }
  .score-big { font-family: var(--font-serif); font-size: 52px; color: var(--red-light); font-weight: 700; }

  /* ── Training ── */
  .training-area { display: flex; flex-direction: column; align-items: center; gap: 20px; }
  .train-nav { display: flex; gap: 12px; align-items: center; }
  .progress-bar { width: 100%; max-width: 300px; height: 3px; background: var(--border); border-radius: 2px; }
  .progress-fill { height: 100%; background: var(--red); border-radius: 2px; transition: width .3s; }
  .train-counter { font-size: 12px; color: var(--text2); }

  /* ── Empty ── */
  .empty-state { text-align: center; padding: 52px 0; color: var(--text3); }
  .empty-icon { font-size: 34px; margin-bottom: 12px; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }

  /* ── Misc ── */
  hr.divider { border: none; border-top: 1px solid var(--border); margin: 22px 0; }
  .text-sm { font-size: 12.5px; }
  .text-muted { color: var(--text2); }
  .flex-row { display: flex; gap: 8px; align-items: center; }
  .mt-2 { margin-top: 8px; }

  /* ── Responsive ── */

  /* Tablet (≤ 900px) : sidebar réduite à icônes seulement */
  @media (max-width: 900px) {
    .sidebar { width: 64px; }
    .sidebar-header { padding: 16px 0; display: flex; align-items: center; justify-content: center; }
    .sidebar-header::after { display: none; }
    .logo-sub { display: none; }
    .logo { font-size: 16px; text-align: center; }
    .nav { padding: 10px 6px; }
    .nav-item { justify-content: center; padding: 10px 0; gap: 0; }
    .nav-item span.nav-label { display: none; }
    .nav-icon { width: auto; font-size: 18px; }
    .main { margin-left: 64px; padding: 24px 20px; }
    .deck-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .flashcard-scene { width: 260px; height: 160px; }
    .card-word { font-size: 19px; }
    .quiz-card { padding: 24px 18px; }
    .quiz-word { font-size: 26px; }
  }

  /* Mobile (≤ 600px) : sidebar cachée, bottom nav */
  @media (max-width: 600px) {
    .sidebar { display: none; }
    .main {
      margin-left: 0;
      padding: 20px 16px 80px;
      max-width: 100vw;
    }
    .page-title { font-size: 22px; }
    .section-header { flex-direction: column; gap: 10px; }
    .section-header > div:last-child { width: 100%; display: flex; gap: 8px; }
    .section-header .flex-row { width: 100%; }
    .section-header .btn { flex: 1; justify-content: center; }

    /* Bottom navigation bar */
    .mobile-nav {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
      background: var(--bg2); border-top: 1px solid var(--border2);
      height: 62px; padding: 0;
    }
    .mobile-nav-item {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 3px; border: none; background: none; color: var(--text3);
      font-size: 10px; font-family: var(--font); font-weight: 500;
      cursor: pointer; transition: all .15s; padding: 6px 0;
    }
    .mobile-nav-item.active { color: var(--red-light); }
    .mobile-nav-item .mob-icon { font-size: 20px; line-height: 1; }

    /* Deck grid : 1 colonne */
    .deck-grid { grid-template-columns: 1fr; }

    /* Flashcards : pleine largeur */
    .flashcard-scene { width: 100%; height: 170px; }
    .cards-row { flex-direction: column; }
    .card-word { font-size: 20px; }

    /* Table → liste mobile */
    .words-table thead { display: none; }
    .words-table tr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid var(--border); gap: 8px;
    }
    .words-table tr:last-child { border-bottom: none; }
    .words-table td { padding: 0; border: none; font-size: 13px; }
    .words-table td:first-child { flex: 1; font-weight: 500; }
    .words-table td:nth-child(2) { flex: 1; color: var(--text2); text-align: right; }
    .words-table td:last-child { flex-shrink: 0; }

    /* Add row : colonne sur mobile */
    .add-row { flex-direction: column; }
    .add-row .btn { width: 100%; justify-content: center; }

    /* Quiz */
    .quiz-card { padding: 22px 16px; }
    .quiz-word { font-size: 26px; }
    .quiz-input { font-size: 16px; }
    .score-big { font-size: 44px; }

    /* Dropdown : ouvre vers le haut sur mobile si near bottom */
    .dropdown-menu { right: 0; min-width: 170px; }

    /* Toast */
    .toast { left: 16px; right: 16px; bottom: 72px; text-align: center; }

    /* Training */
    .progress-bar { max-width: 100%; }
    .train-nav { width: 100%; justify-content: center; }
    .train-nav .btn { flex: 1; justify-content: center; }

    /* Modal */
    .modal { padding: 22px 18px; }
  }

  /* Desktop hide mobile nav */
  @media (min-width: 601px) {
    .mobile-nav { display: none; }
  }
`;


// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
    return <div className={`toast ${type}`}>{message}</div>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-title">{title}</div>
                {children}
            </div>
        </div>
    );
}

// ─── CSV Menu ─────────────────────────────────────────────────────────────────
function CSVMenu({ deck, onImport, toast, label = "↕ CSV" }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const handleFile = (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const cards = parseCSV(ev.target.result);
                onImport(cards);
                toast(`${cards.length} mot${cards.length !== 1 ? "s" : ""} importé${cards.length !== 1 ? "s" : ""} !`, "success");
            } catch (err) { toast("Erreur : " + err.message, "error"); }
        };
        reader.readAsText(file, "UTF-8");
        setOpen(false);
    };

    return (
        <div className="dropdown-wrap" ref={ref}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>{label}</button>
            {open && (
                <div className="dropdown-menu">
                    {deck && <>
                        <div className="dropdown-section">
                            <div className="dropdown-label">Exporter</div>
                            <button className="dropdown-item" onClick={() => { exportCSV(deck); setOpen(false); toast("CSV téléchargé !", "success"); }}>
                                📊 Télécharger en CSV
                            </button>
                        </div>
                        <div className="dropdown-divider" />
                    </>}
                    <div className="dropdown-section">
                        <div className="dropdown-label">Importer</div>
                        <label className="import-label">
                            📂 Depuis un fichier CSV
                            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Deck Modal ───────────────────────────────────────────────────────────────
function DeckModal({ initial, onSave, onClose }) {
    const [name, setName] = useState(initial?.name || "");
    const [err, setErr] = useState("");
    const submit = () => {
        if (!name.trim()) { setErr("Le nom est requis."); return; }
        onSave({ name: name.trim() });
    };
    return (
        <Modal title={initial ? "Renommer le tableau" : "Nouveau tableau"} onClose={onClose}>
            <div className="field">
                <label>Nom du tableau</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vocabulaire voyage" onKeyDown={e => e.key === "Enter" && submit()} autoFocus />
                {err && <div className="error-msg">{err}</div>}
            </div>
            <div className="modal-actions">
                <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
                <button className="btn btn-primary" onClick={submit}>Enregistrer</button>
            </div>
        </Modal>
    );
}

// ─── Flashcard ────────────────────────────────────────────────────────────────
function FlashCard({ card }) {
    const [flipped, setFlipped] = useState(false);
    useEffect(() => { setFlipped(false); }, [card.id]);
    return (
        <div className="flashcard-scene" onClick={() => setFlipped(f => !f)}>
            <div className={`flashcard-inner ${flipped ? "flipped" : ""}`}>
                <div className="flashcard-face flashcard-front">
                    <div className="card-lang">🇹🇷 Turc</div>
                    <div className="card-word">{card.tr}</div>
                    <div className="card-hint">cliquer pour retourner</div>
                </div>
                <div className="flashcard-face flashcard-back">
                    <div className="card-lang">🇫🇷 Français</div>
                    <div className="card-word">{card.fr}</div>
                    <div className="card-hint">cliquer pour masquer</div>
                </div>
            </div>
        </div>
    );
}

// ─── My Decks Page ────────────────────────────────────────────────────────────
function MyDecksPage({ decks, onCreateDeck, onEditDeck, onDeleteDeck, onOpenDeck, onMergeCards, toast }) {
    const [showCreate, setShowCreate] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [pendingImport, setPendingImport] = useState(null);

    return (
        <div>
            <div className="section-header">
                <div>
                    <div className="page-title">Mes tableaux</div>
                    <div className="page-sub">{decks.length} tableau{decks.length !== 1 ? "x" : ""}</div>
                </div>
                <div className="flex-row">
                    <CSVMenu deck={null} onImport={cards => setPendingImport(cards)} toast={toast} label="↑ Importer CSV" />
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Nouveau</button>
                </div>
            </div>

            {decks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📚</div>
                    <div className="empty-title">Aucun tableau</div>
                    <div>Créez votre premier tableau ou importez un fichier CSV</div>
                </div>
            ) : (
                <div className="deck-grid">
                    {decks.map(deck => (
                        <div key={deck.id} className="deck-card" onClick={() => onOpenDeck(deck)}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                                <div className="deck-name">{deck.name}</div>
                                <div className="deck-badge" style={{ position: "static", flexShrink: 0 }}>{deck.cards.length} mots</div>
                            </div>
                            <div className="deck-meta">{new Date(deck.createdAt).toLocaleDateString("fr-FR")}</div>
                            <div className="deck-actions" onClick={e => e.stopPropagation()}>
                                <CSVMenu deck={deck} onImport={cards => onMergeCards(deck.id, cards)} toast={toast} label="↕" />
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(deck)}>✎</button>
                                <button className="btn btn-danger btn-sm" onClick={() => onDeleteDeck(deck.id)}>✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <DeckModal
                    onSave={data => { onCreateDeck(data); setShowCreate(false); toast("Tableau créé !", "success"); }}
                    onClose={() => setShowCreate(false)}
                />
            )}
            {editTarget && (
                <DeckModal
                    initial={editTarget}
                    onSave={data => { onEditDeck(editTarget.id, data); setEditTarget(null); toast("Renommé !", "success"); }}
                    onClose={() => setEditTarget(null)}
                />
            )}
            {pendingImport && (
                <DeckModal
                    initial={{ name: "Tableau importé" }}
                    onSave={data => { onCreateDeck(data, pendingImport); setPendingImport(null); toast(`${pendingImport.length} mots importés !`, "success"); }}
                    onClose={() => setPendingImport(null)}
                />
            )}
        </div>
    );
}

// ─── Editable row ────────────────────────────────────────────────────────────
function EditableRow({ card, onSave, onRemove }) {
    const [editing, setEditing] = useState(false);
    const [eFr, setEFr] = useState(card.fr);
    const [eTr, setETr] = useState(card.tr);
    const trRef = useRef();

    const startEdit = () => { setEFr(card.fr); setETr(card.tr); setEditing(true); };
    const cancel = () => setEditing(false);
    const save = () => {
        if (!eFr.trim() || !eTr.trim()) return;
        onSave({ ...card, fr: eFr.trim(), tr: eTr.trim() });
        setEditing(false);
    };

    if (editing) return (
        <tr className="editing-row">
            <td><input value={eFr} onChange={e => setEFr(e.target.value)} onKeyDown={e => e.key === "Tab" && (e.preventDefault(), trRef.current?.focus())} autoFocus /></td>
            <td><input ref={trRef} value={eTr} onChange={e => setETr(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }} /></td>
            <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-primary btn-sm" onClick={save}>✓</button>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }} onClick={cancel}>✕</button>
            </td>
        </tr>
    );

    return (
        <tr className="word-row" onDoubleClick={startEdit} title="Double-cliquer pour modifier">
            <td>{card.fr}</td>
            <td>{card.tr}</td>
            <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-ghost btn-sm" onClick={startEdit} title="Modifier">✎</button>
                <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => onRemove(card.id)}>✕</button>
            </td>
        </tr>
    );
}

// ─── Deck Detail ──────────────────────────────────────────────────────────────
function DeckDetail({ deck, onUpdateCards, onBack, toast }) {
    const [fr, setFr] = useState("");
    const [tr, setTr] = useState("");
    const [err, setErr] = useState("");
    const [search, setSearch] = useState("");
    const trRef = useRef();

    const add = () => {
        if (!fr.trim() || !tr.trim()) { setErr("Les deux champs sont requis."); return; }
        onUpdateCards([...deck.cards, { id: uid(), fr: fr.trim(), tr: tr.trim() }]);
        setFr(""); setTr(""); setErr("");
    };
    const remove = (id) => onUpdateCards(deck.cards.filter(c => c.id !== id));
    const saveCard = (updated) => onUpdateCards(deck.cards.map(c => c.id === updated.id ? updated : c));

    const filtered = search.trim()
        ? deck.cards.filter(c =>
            c.fr.toLowerCase().includes(search.toLowerCase()) ||
            c.tr.toLowerCase().includes(search.toLowerCase()))
        : deck.cards;

    return (
        <div>
            <div className="section-header">
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 10 }}>← Retour</button>
                    <div className="page-title">{deck.name}</div>
                    <div className="page-sub">{deck.cards.length} mot{deck.cards.length !== 1 ? "s" : ""}</div>
                </div>
                <CSVMenu
                    deck={deck}
                    onImport={cards => {
                        const merged = [...deck.cards, ...cards.filter(nc => !deck.cards.find(ec => ec.fr === nc.fr && ec.tr === nc.tr))];
                        onUpdateCards(merged);
                    }}
                    toast={toast}
                />
            </div>



            <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        Liste des mots
                        {search && filtered.length !== deck.cards.length && (
                            <span style={{ color: "var(--text3)", fontWeight: 400, fontSize: 12, marginLeft: 8 }}>{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</span>
                        )}
                    </div>
                    {deck.cards.length > 4 && (
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="🔍 Rechercher un mot..."
                            style={{ width: "auto", flex: 1, maxWidth: 240, padding: "7px 12px", fontSize: 13 }}
                        />
                    )}
                </div>

                {filtered.length > 0 && (
                    <table className="words-table">
                        <thead>
                            <tr>
                                <th>🇫🇷 Français</th>
                                <th>🇹🇷 Turc</th>
                                <th style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>double-clic pour éditer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <EditableRow key={c.id} card={c} onSave={saveCard} onRemove={remove} />
                            ))}
                        </tbody>
                    </table>
                )}
                {search && filtered.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 13 }}>Aucun mot ne correspond à "{search}"</div>
                )}

                <div className="add-row" style={{ marginTop: deck.cards.length > 0 ? 14 : 0 }}>
                    <input value={fr} onChange={e => setFr(e.target.value)} placeholder="Mot en français"
                        onKeyDown={e => e.key === "Tab" && (e.preventDefault(), trRef.current?.focus())} />
                    <input ref={trRef} value={tr} onChange={e => setTr(e.target.value)} placeholder="Mot en turc"
                        onKeyDown={e => e.key === "Enter" && add()} />
                    <button className="btn btn-primary" onClick={add}>Ajouter</button>
                </div>
                {err && <div className="error-msg">{err}</div>}
            </div>
        </div>
    );
}

// ─── Training Page ────────────────────────────────────────────────────────────
function TrainingPage({ decks }) {
    const [selId, setSelId] = useState(decks[0]?.id || "");
    const [idx, setIdx] = useState(0);
    const deck = decks.find(d => d.id === selId);
    const cards = deck?.cards || [];
    useEffect(() => setIdx(0), [selId]);

    return (
        <div>
            <div className="page-title">Entraînement</div>
            <div className="page-sub">Révisez vos flashcards</div>
            <div style={{ marginBottom: 24 }}>
                <label>Tableau</label>
                <select value={selId} onChange={e => setSelId(e.target.value)} style={{ maxWidth: 320 }}>
                    {decks.map(d => <option key={d.id} value={d.id}>{d.name} ({d.cards.length} mots)</option>)}
                </select>
            </div>

            {!deck || cards.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🃏</div>
                    <div className="empty-title">Aucune carte dans ce tableau</div>
                </div>
            ) : (
                <div className="training-area">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
                    </div>
                    <div className="train-counter">{idx + 1} / {cards.length}</div>
                    <FlashCard key={cards[idx].id} card={cards[idx]} />
                    <div className="train-nav">
                        <button className="btn btn-ghost" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>← Précédent</button>
                        <button className="btn btn-primary" onClick={() => setIdx(i => Math.min(cards.length - 1, i + 1))} disabled={idx === cards.length - 1}>Suivant →</button>
                    </div>
                    {idx === cards.length - 1 && (
                        <div style={{ textAlign: "center", padding: "11px 16px", background: "var(--red-bg)", border: "1px solid rgba(200,16,46,0.2)", borderRadius: "var(--radius)", fontSize: 13 }}>
                            <span style={{ color: "#f8b0bb" }}>Tebrikler ! Toutes les cartes vues.</span>
                            <button className="btn btn-danger btn-sm" style={{ marginLeft: 12 }} onClick={() => setIdx(0)}>Recommencer</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Quiz Page ────────────────────────────────────────────────────────────────
function QuizPage({ decks }) {
    const [selId, setSelId] = useState(decks[0]?.id || "");
    const [started, setStarted] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [qIdx, setQIdx] = useState(0);
    const [answer, setAnswer] = useState("");
    const [checked, setChecked] = useState(false);
    const [results, setResults] = useState([]);
    const [finished, setFinished] = useState(false);
    const inputRef = useRef();
    const deck = decks.find(d => d.id === selId);

    const startQuiz = () => {
        const cards = deck?.cards || [];
        if (!cards.length) return;
        const qs = [...cards].sort(() => Math.random() - 0.5).map(c => {
            const frToTr = Math.random() > 0.5;
            return { frToTr, question: frToTr ? c.fr : c.tr, answer: frToTr ? c.tr : c.fr };
        });
        setQuestions(qs); setQIdx(0); setAnswer(""); setChecked(false); setResults([]); setFinished(false); setStarted(true);
        setTimeout(() => inputRef.current?.focus(), 80);
    };

    const check = () => {
        if (!answer.trim()) return;
        setResults(r => [...r, normalize(answer) === normalize(questions[qIdx].answer)]);
        setChecked(true);
    };

    const next = () => {
        if (qIdx + 1 >= questions.length) { setFinished(true); return; }
        setQIdx(i => i + 1); setAnswer(""); setChecked(false);
        setTimeout(() => inputRef.current?.focus(), 80);
    };

    if (!started) return (
        <div>
            <div className="page-title">Quiz</div>
            <div className="page-sub">Testez vos connaissances</div>
            <div className="card" style={{ maxWidth: 400 }}>
                <div className="field">
                    <label>Tableau</label>
                    <select value={selId} onChange={e => setSelId(e.target.value)}>
                        {decks.map(d => <option key={d.id} value={d.id}>{d.name} ({d.cards.length} mots)</option>)}
                    </select>
                </div>
                <div className="text-sm text-muted mt-2" style={{ marginBottom: 16 }}>
                    Direction aléatoire FR→TR ou TR→FR. Accents et casse ignorés.
                </div>
                <button className="btn btn-primary" onClick={startQuiz} disabled={!deck || !deck.cards.length}>
                    Başla — Commencer
                </button>
            </div>
        </div>
    );

    if (finished) {
        const score = results.filter(Boolean).length;
        return (
            <div>
                <div className="page-title">Résultats</div>
                <div className="quiz-card">
                    <div className="score-big">{score}/{questions.length}</div>
                    <div className="text-muted mt-2" style={{ marginBottom: 18, fontSize: 14 }}>
                        {score === questions.length ? "Mükemmel ! Parfait ! 🌟" : score >= questions.length * 0.7 ? "Çok iyi ! Très bien 👍" : "Devam et ! Continue 💪"}
                    </div>
                    <div className="quiz-progress" style={{ marginBottom: 20 }}>
                        {results.map((r, i) => <div key={i} className={`quiz-dot ${r ? "done-correct" : "done-wrong"}`} />)}
                    </div>
                    <div className="flex-row" style={{ justifyContent: "center" }}>
                        <button className="btn btn-ghost" onClick={() => setStarted(false)}>Changer</button>
                        <button className="btn btn-primary" onClick={startQuiz}>Recommencer</button>
                    </div>
                </div>
            </div>
        );
    }

    const q = questions[qIdx];
    const isCorrect = checked ? normalize(answer) === normalize(q.answer) : null;

    return (
        <div>
            <div className="page-title">Quiz</div>
            <div className="quiz-card">
                <div className="quiz-progress">
                    {questions.map((_, i) => (
                        <div key={i} className={`quiz-dot ${i < qIdx ? (results[i] ? "done-correct" : "done-wrong") : i === qIdx ? "current" : ""}`} />
                    ))}
                </div>
                <div className="quiz-lang-badge">{q.frToTr ? "Français → Turc" : "Turc → Français"}</div>
                <div className="quiz-word">{q.question}</div>
                {!checked ? (
                    <>
                        <input ref={inputRef} className="quiz-input" value={answer} onChange={e => setAnswer(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && check()} placeholder="Votre réponse..." />
                        <button className="btn btn-primary w-full" onClick={check} disabled={!answer.trim()}>Vérifier</button>
                    </>
                ) : (
                    <>
                        <div className={`quiz-result ${isCorrect ? "correct" : "wrong"}`}>
                            {isCorrect ? "✓ Doğru !" : "✗ Yanlış"}
                        </div>
                        {!isCorrect && (
                            <div className="text-muted mt-2" style={{ marginBottom: 12, fontSize: 13.5 }}>
                                Réponse correcte : <strong style={{ color: "var(--text)" }}>{q.answer}</strong>
                            </div>
                        )}
                        <button className="btn btn-primary w-full" onClick={next}>
                            {qIdx + 1 < questions.length ? "Suivant →" : "Voir les résultats"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    const [decks, setDecks] = useState(() => load());
    const [page, setPage] = useState("decks");
    const [openDeck, setOpenDeck] = useState(null);
    const [toast, setToast] = useState(null);

    const persist = useCallback((next) => { setDecks(next); save(next); }, []);
    const showToast = (msg, type = "success") => setToast({ msg, type, id: uid() });

    const createDeck = ({ name }, cards = []) => persist([...decks, { id: uid(), name, cards, createdAt: Date.now() }]);
    const editDeck = (id, { name }) => persist(decks.map(d => d.id === id ? { ...d, name } : d));
    const deleteDeck = (id) => { persist(decks.filter(d => d.id !== id)); if (openDeck?.id === id) setOpenDeck(null); showToast("Tableau supprimé."); };

    const updateCards = (id, cards) => {
        persist(decks.map(d => d.id === id ? { ...d, cards } : d));
        setOpenDeck(od => od ? { ...od, cards } : od);
    };
    const mergeCards = (id, newCards) => {
        const deck = decks.find(d => d.id === id); if (!deck) return;
        const merged = [...deck.cards, ...newCards.filter(nc => !deck.cards.find(ec => ec.fr === nc.fr && ec.tr === nc.tr))];
        updateCards(id, merged);
        showToast(`${newCards.length} mots fusionnés !`);
    };

    const navItems = [
        { id: "decks", icon: "🗂", label: "Mes tableaux" },
        { id: "training", icon: "🃏", label: "Entraînement" },
        { id: "quiz", icon: "🎯", label: "Quiz" },
    ];

    const renderPage = () => {
        if (openDeck) {
            const deck = decks.find(d => d.id === openDeck.id);
            if (!deck) { setOpenDeck(null); return null; }
            return <DeckDetail deck={deck} onUpdateCards={cards => updateCards(deck.id, cards)} onBack={() => setOpenDeck(null)} toast={showToast} />;
        }
        switch (page) {
            case "decks": return <MyDecksPage decks={decks} onCreateDeck={createDeck} onEditDeck={editDeck} onDeleteDeck={deleteDeck} onOpenDeck={setOpenDeck} onMergeCards={mergeCards} toast={showToast} />;
            case "training": return <TrainingPage decks={decks} />;
            case "quiz": return <QuizPage decks={decks} />;
            default: return null;
        }
    };

    return (
        <>
            <style>{CSS}</style>
            <div className="app">
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <div className="logo">LinguaCards</div>
                        <div className="logo-sub">Français · Türkçe</div>
                    </div>
                    <nav className="nav">
                        {navItems.map(item => (
                            <button key={item.id}
                                className={`nav-item ${page === item.id && !openDeck ? "active" : ""}`}
                                onClick={() => { setPage(item.id); setOpenDeck(null); }}>
                                <span className="nav-icon">{item.icon}</span>
                                <span className="nav-label">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                </aside>
                <main className="main">{renderPage()}</main>
            </div>
            {/* Mobile bottom nav */}
            <nav className="mobile-nav">
                {navItems.map(item => (
                    <button key={item.id}
                        className={`mobile-nav-item ${page === item.id && !openDeck ? "active" : ""}`}
                        onClick={() => { setPage(item.id); setOpenDeck(null); }}>
                        <span className="mob-icon">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>
            {toast && <Toast key={toast.id} message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        </>
    );
}
