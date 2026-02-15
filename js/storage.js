// js/storage.js
// ------------------------------------------------------------
// Central storage + normalisation helpers.
//
// NOTE TO SELF (design decisions):
// - Questions define the "schema" of responses (but schema can evolve).
// - Entries store:
//   - date (YYYY-MM-DD)
//   - responses (keyed by question id)
//   - comment (free text narrative)
//   - meta (e.g., versionAtTime per question)
// - Always normalise on load so older backups don’t break new code.
// ------------------------------------------------------------

export const STORAGE_KEYS = {
  QUESTIONS: "questions",
  ENTRIES: "entries",
  PIN_HASH: "pinHash",
};

// ------------------------------------------------------------
// Reset everything (double confirm)
// ------------------------------------------------------------
export function resetAllData() {
  const first = confirm(
    "Reset EVERYTHING? This will permanently delete all questions and all entries."
  );
  if (!first) return;

  const second = confirm("Are you absolutely sure? This cannot be undone.");
  if (!second) return;

  // NOTE TO SELF:
  // Remove only what this app owns. Avoid localStorage.clear().
  const keysToRemove = [
    STORAGE_KEYS.QUESTIONS,
    STORAGE_KEYS.ENTRIES,

    // Legacy/extra keys (safe cleanup)
    "archivedQuestions",

    // OPTIONAL:
    // Remove PIN lock too. If you want to keep PIN after reset, delete this line.
    STORAGE_KEYS.PIN_HASH,
  ];

  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Session state (edit mode, unlock status etc.)
  sessionStorage.removeItem("editEntryId");
  // sessionStorage.removeItem("unlocked"); // OPTIONAL: uncomment to lock app after reset

  alert("All data cleared. Starting fresh.");
}

// ------------------------------------------------------------
// Safe JSON parse (prevents broken storage from killing the app)
// ------------------------------------------------------------
export function safeJSONParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------
export function nowISO() {
  return new Date().toISOString();
}

export function todayISODate() {
  // YYYY-MM-DD
  return new Date().toISOString().split("T")[0];
}

// Safer parse for YYYY-MM-DD to avoid timezone shifting
export function parseLocalDate(yyyyMMdd) {
  if (!yyyyMMdd || typeof yyyyMMdd !== "string") return null;
  const [y, m, d] = yyyyMMdd.split("-").map(n => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// ------------------------------------------------------------
// ID helper
// NOTE TO SELF:
// Collisions are extremely unlikely for this app’s scale.
// If you ever sync across devices, move to UUID.
// ------------------------------------------------------------
export function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ------------------------------------------------------------
// Tags helper (comma-separated string <-> string[])
// ------------------------------------------------------------
export function normaliseTags(tags) {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags.map(t => String(t).trim()).filter(Boolean);
  }

  return String(tags)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------
// Scale helper (for number questions)
// NOTE TO SELF:
// Return null if nothing is set, so consumers can apply defaults.
// ------------------------------------------------------------
export function normaliseScale(scale) {
  if (!scale || typeof scale !== "object") return null;

  const minRaw = scale.min ?? null;
  const maxRaw = scale.max ?? null;
  const stepRaw = scale.step ?? null;

  const anySet = [minRaw, maxRaw, stepRaw].some(
    v => v !== null && v !== "" && v !== undefined
  );
  if (!anySet) return null;

  const toNumOrNull = v => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    min: toNumOrNull(minRaw),
    max: toNumOrNull(maxRaw),
    step: toNumOrNull(stepRaw),
  };
}

// ------------------------------------------------------------
// Question normalisation
// NOTE TO SELF:
// Keep question shape stable so UI + charts + exports stay predictable.
// ------------------------------------------------------------
export function normaliseQuestion(q) {
  const nq = { ...(q || {}) };

  if (!nq.id) nq.id = createId("q");

  nq.text = String(nq.text ?? "").trim();
  nq.type = nq.type || "text";

  // Options only make sense for select questions, but we keep them if they exist
  // to avoid losing data when type changes temporarily.
  if (nq.type === "select") {
    nq.options = Array.isArray(nq.options)
      ? nq.options.map(o => String(o).trim()).filter(Boolean)
      : [];
  } else {
    if (Array.isArray(nq.options)) {
      nq.options = nq.options.map(o => String(o).trim()).filter(Boolean);
    } else {
      nq.options = nq.options ?? undefined;
    }
  }

  nq.tags = normaliseTags(nq.tags);
  nq.archived = Boolean(nq.archived);

  const v = Number(nq.version);
  nq.version = Number.isFinite(v) && v > 0 ? v : 1;

  nq.scale = normaliseScale(nq.scale);

  if (nq.units !== undefined && nq.units !== null) {
    nq.units = String(nq.units);
  }

  return nq;
}

// ------------------------------------------------------------
// Questions storage
// ------------------------------------------------------------
export function saveQuestions(questions) {
  localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
}

export function loadQuestions() {
  const raw = safeJSONParse(localStorage.getItem(STORAGE_KEYS.QUESTIONS) || "[]", []);
  const norm = Array.isArray(raw) ? raw.map(normaliseQuestion) : [];

  // NOTE TO SELF:
  // Write-back normalised data so future loads are consistent.
  localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(norm));
  return norm;
}

// ------------------------------------------------------------
// Entry normalisation
// NOTE TO SELF:
// entries.comment is NEW. Normalisation ensures older backups still work.
// ------------------------------------------------------------
export function normaliseEntry(e) {
  const ne = { ...(e || {}) };

  if (!ne.id) ne.id = createId("e");
  ne.date = ne.date || todayISODate();

  ne.responses = ne.responses && typeof ne.responses === "object" ? ne.responses : {};
  ne.meta = ne.meta && typeof ne.meta === "object" ? ne.meta : {};

  ne.createdAt = ne.createdAt || nowISO();
  ne.updatedAt = ne.updatedAt || nowISO();

  // NEW: clinician-friendly narrative context
  ne.comment = ne.comment ? String(ne.comment) : "";

  return ne;
}

// ------------------------------------------------------------
// Entries storage
// ------------------------------------------------------------
export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
}

export function loadEntries() {
  const raw = safeJSONParse(localStorage.getItem(STORAGE_KEYS.ENTRIES) || "[]", []);
  const norm = Array.isArray(raw) ? raw.map(normaliseEntry) : [];

  localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(norm));
  return norm;
}

// ------------------------------------------------------------
// Version bump logic
// NOTE TO SELF:
// Bump version when question MEANING changes so old data is interpretable.
// Current triggers:
// - type change
// - select options change
// - number scale change
// ------------------------------------------------------------
export function needsVersionBump(oldQ, newQ) {
  if (!oldQ) return false;

  const oldType = oldQ.type || "text";
  const newType = newQ.type || "text";
  if (oldType !== newType) return true;

  if (oldType === "select") {
    const a = (Array.isArray(oldQ.options) ? oldQ.options : []).join("||");
    const b = (Array.isArray(newQ.options) ? newQ.options : []).join("||");
    if (a !== b) return true;
  }

  if (oldType === "number") {
    const aS = normaliseScale(oldQ.scale);
    const bS = normaliseScale(newQ.scale);

    const a = aS ? `${aS.min}|${aS.max}|${aS.step}` : "null";
    const b = bS ? `${bS.min}|${bS.max}|${bS.step}` : "null";
    if (a !== b) return true;
  }

  return false;
}

// ------------------------------------------------------------
// Display helpers
// ------------------------------------------------------------
export function formatQuestionLabel(q, { includeArchivedTag = true } = {}) {
  let label = q.text || "(untitled)";
  if (includeArchivedTag && q.archived) label += " (archived)";
  return label;
}

export function isFilledValue(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "";
  return true;
}
