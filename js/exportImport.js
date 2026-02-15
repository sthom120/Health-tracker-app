// js/exportImport.js
// ------------------------------------------------------------
// Export / Import helpers for view.html
//
// Exports:
// - JSON backup (questions + entries)
// - CSV (flat, human-readable, includes Comment)
//
// Imports:
// - Either a raw entries array
// - Or a backup object containing { entries, questions }
//
// NOTE TO SELF:
// - storage.js normalisation keeps older backups compatible.
// - We include entry.comment (free text) in exports.
// ------------------------------------------------------------

import {
  loadEntries,
  loadQuestions,
  saveEntries,
  saveQuestions,
  normaliseEntry,
  normaliseQuestion,
  nowISO,
  formatQuestionLabel,
} from "./storage.js";

/* ------------------------------------------------------------
   Download helper (creates a temporary blob + click link)
------------------------------------------------------------ */
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------
   CSV value formatter
   NOTE TO SELF:
   - select questions store arrays -> join nicely
   - boolean stored as true/false/null -> export as Yes/No/blank
------------------------------------------------------------ */
function formatCSVCell(val) {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return val.join(", ");
  if (val === true) return "Yes";
  if (val === false) return "No";
  return String(val);
}

function escapeCSV(val) {
  // Wrap in quotes and escape quotes inside value
  return `"${String(val).replace(/"/g, '""')}"`;
}

/* ------------------------------------------------------------
   Main init
   getQuestionsForView: fn that returns questions (usually active ones, or all)
   refresh: fn to re-render table/summary/chart after import
------------------------------------------------------------ */
export function initExportImport({ getQuestionsForView, refresh } = {}) {
  const exportJSONBtn = document.getElementById("exportJSON");
  const exportCSVBtn = document.getElementById("exportCSV");
  const importJSONInput = document.getElementById("importJSON");

  /* ----------------------------------------------------------
     Export JSON backup (questions + entries)
  ---------------------------------------------------------- */
  exportJSONBtn?.addEventListener("click", () => {
    const entries = loadEntries();
    const questions = loadQuestions();

    if (!entries.length) {
      alert("No entries to export.");
      return;
    }

    const backup = {
      // NOTE TO SELF: bump whenever structure changes
      // - entries.comment added
      // - questions may now include preset/units/descriptorText/time type
      exportVersion: 3,
      exportedAt: nowISO(),
      questions,
      entries,
    };

    downloadFile(
      "tracker-backup.json",
      JSON.stringify(backup, null, 2),
      "application/json"
    );
  });

  /* ----------------------------------------------------------
     Export CSV (flat + clinician-friendly)
     NOTE TO SELF:
     - We include Comment as a column at the end.
     - Uses the questions you’re currently showing in view (so filters apply).
  ---------------------------------------------------------- */
  exportCSVBtn?.addEventListener("click", () => {
    const entries = loadEntries();
    if (!entries.length) {
      alert("No entries to export.");
      return;
    }

    const qs = typeof getQuestionsForView === "function" ? getQuestionsForView() : loadQuestions();

    const headers = ["Date", ...qs.map(q => formatQuestionLabel(q)), "Comment"];

    const rows = entries.map(entry => {
      const responses = qs.map(q => {
        const v = entry.responses ? entry.responses[q.id] : "";
        return formatCSVCell(v);
      });

      const comment = entry.comment ? String(entry.comment) : "";
      return [entry.date, ...responses, comment];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\n");

    downloadFile("tracker-data.csv", csv, "text/csv");
  });

  /* ----------------------------------------------------------
     Import JSON (raw entries array OR backup object)
     NOTE TO SELF:
     - Incoming questions merge by id (incoming wins)
     - Entries are replaced (simple + predictable)
     - normaliseEntry() ensures comment exists even in older backups
  ---------------------------------------------------------- */
  importJSONInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      let importedEntries = null;
      let importedQuestions = null;

      if (Array.isArray(imported)) {
        // Raw entries list
        importedEntries = imported;
      } else if (imported && typeof imported === "object") {
        // Backup object
        if (Array.isArray(imported.entries)) importedEntries = imported.entries;
        if (Array.isArray(imported.questions)) importedQuestions = imported.questions;
      }

      if (!Array.isArray(importedEntries)) {
        alert("Invalid file format. Expected an entries list or a backup object.");
        return;
      }

      // Merge questions (if provided)
      if (Array.isArray(importedQuestions)) {
        const currentQs = loadQuestions();
        const incomingQs = importedQuestions.map(normaliseQuestion);

        // Merge by id (incoming wins)
        const merged = new Map();
        currentQs.forEach(q => merged.set(q.id, q));
        incomingQs.forEach(q => merged.set(q.id, q));

        saveQuestions(Array.from(merged.values()));
      }

      // Replace entries with imported entries (normalised)
      saveEntries(importedEntries.map(normaliseEntry));

      // Refresh view
      if (typeof refresh === "function") refresh();

      alert("Import successful!");
    } catch (err) {
      console.error(err);
      alert("Could not read JSON file.");
    } finally {
      // Allow re-importing the same file later
      event.target.value = "";
    }
  });
}
