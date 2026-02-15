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
// - Number questions can optionally use PRESETS (pain scale etc.)
// ------------------------------------------------------------

export const STORAGE_KEYS = {
  QUESTIONS: "questions",
  ENTRIES: "entries",
  PIN_HASH: "pinHash",
};

// ------------------------------------------------------------
// Number presets
// NOTE TO SELF:
// - Presets fill sensible defaults for scale/units/help text.
// - User can still override scale/units/descriptors.
// ------------------------------------------------------------
export const NUMBER_PRESETS = {
  pain_0_10: {
    preset: "pain_0_10",
    scale: { min: 0, max: 10, step: 1 },
    units: "",
    helpText: "0 = pain free, 10 = worst imaginable.",
    descriptorText: `0 – Pain Free

Mild Pain – Nagging, annoying, but doesn’t really interfere with daily living activities.
1 – Pain is very mild, barely noticeable. Most of the time you don’t think about it.
2 – Minor pain. Annoying and may have occasional stronger twinges.
3 – Pain is noticeable and distracting, however, you can get used to it and adapt.

Moderate Pain – Interferes significantly with daily living activities.
4 – Moderate pain. If you are deeply involved in an activity, it can be ignored for a period of time, but is still distracting.
5 – Moderately strong pain. It can’t be ignored for more than a few minutes, but with effort you still can manage to work or participate in some social activities.
6 – Moderately strong pain that interferes with normal daily activities. Difficulty concentrating.

Severe Pain – Disabling; unable to perform daily living activities.
7 – Severe pain that dominates your senses and significantly limits your ability to perform normal daily activities or maintain social relationships. Interferes with sleep.
8 – Intense pain. Physical activity is severely limited. Conversing requires great effort.
9 – Excruciating pain. Unable to converse. Crying out and/or moaning uncontrollably.
10 – Unspeakable pain. Bedridden and possibly delirious.`,
  },

  stiffness_0_10: {
    preset: "stiffness_0_10",
    scale: { min: 0, max: 10, step: 1 },
    units: "",
    helpText: "0 = no stiffness, 10 = worst imaginable.",
    descriptorText: "",
  },

  fatigue_0_10: {
    preset: "fatigue_0_10",
    scale: { min: 0, max: 10, step: 1 },
    units: "",
    helpText: "",
    descriptorText: "",
  },

  stress_0_10: {
    preset: "stress_0_10",
    scale: { min: 0, max: 10, step: 1 },
    units: "",
    helpText: "",
    descriptorText: "",
  },

  mood_1_5: {
    preset: "mood_1_5",
    scale: { min: 1, max: 5, step: 1 },
    units: "",
    helpText: "",
    descriptorText: "",
  },

  sleep_hours: {
    preset: "sleep_hours",
    scale: { min: 0, max: 14, step: 0.5 },
    units: "hours",
    helpText: "",
    descriptorText: "",
  },

  exercise_minutes: {
    preset: "exercise_minutes",
    scale: { min: 0, max: 300, step: 5 },
    units: "minutes",
    helpText: "",
    descriptorText: "",
  },
};

export function applyNumberPreset(q) {
  if (!q || q.type !== "number") return q;

  const key = String(q.preset || "").trim();
  if (!key || !NUMBER_PRESETS[key]) return q;

  const p = NUMBER_PRESETS[key];

  // NOTE TO SELF:
  // Preset fills defaults, but anything user already set wins.
  return {
    ...q,
    preset: p.preset,
    scale: q.scale ?? p.scale,
    units: (q.units ?? "") || (p.units ?? ""),
    helpText: (q.helpText ?? "") || (p.helpText ?? ""),
    descriptorText: (q.descriptorText ?? "") || (p.descriptorText ?? ""),
  };
}

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

  // Number extras
  nq.preset = nq.preset ? String(nq.preset) : "";
  nq.units = nq.units ? String(nq.units) : "";
  nq.helpText = nq.helpText ? String(nq.helpText) : "";
  nq.descriptorText = nq.descriptorText ? String(nq.descriptorText) : "";

  nq.scale = normaliseScale(nq.scale);

  // Apply preset defaults (if preset is selected)
  return applyNumberPreset(nq);
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

  // Write-back normalised data so future loads are consistent.
  localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(norm));
  return norm;
}

// ------------------------------------------------------------
// Entry normalisation
// NOTE TO SELF:
// entries.comment is supported; normalisation ensures older backups still work.
// ------------------------------------------------------------
export function normaliseEntry(e) {
  const ne = { ...(e || {}) };

  if (!ne.id) ne.id = createId("e");
  ne.date = ne.date || todayISODate();

  ne.responses = ne.responses && typeof ne.responses === "object" ? ne.responses : {};
  ne.meta = ne.meta && typeof ne.meta === "object" ? ne.meta : {};

  ne.createdAt = ne.createdAt || nowISO();
  ne.updatedAt = ne.updatedAt || nowISO();

  // Clinician-friendly narrative context
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
// - (optional) preset change
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
    // If you switch presets, that is usually a meaning change.
    if (String(oldQ.preset || "") !== String(newQ.preset || "")) return true;

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
