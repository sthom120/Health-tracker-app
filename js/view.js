// js/exportImport.js
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

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export function initExportImport({ getQuestionsForView, refresh }) {
  const exportJSONBtn = document.getElementById("exportJSON");
  const exportCSVBtn = document.getElementById("exportCSV");
  const importJSONInput = document.getElementById("importJSON");

  // Export backup JSON (questions + entries, including comment)
  exportJSONBtn?.addEventListener("click", () => {
    const entries = loadEntries();
    const questions = loadQuestions();

    if (!entries.length) return alert("No entries to export.");

    const backup = {
      exportVersion: 3, // bumped because entries may include comment now
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

  // Export CSV (flat + clinician-friendly)
  exportCSVBtn?.addEventListener("click", () => {
    const entries = loadEntries();
    if (!entries.length) return alert("No entries to export.");

    const qs = getQuestionsForView();

    // NOTE TO SELF:
    // Put Comment just before end or after responses — it’s narrative context.
    const headers = ["Date", ...qs.map(q => formatQuestionLabel(q)), "Comment"];

    const rows = entries.map(entry => {
      const responses = qs.map(q => {
        const val = entry.responses ? entry.responses[q.id] : "";
        if (val === null) return "";
        return Array.isArray(val) ? val.join(", ") : (val ?? "");
      });

      const comment = entry.comment ? String(entry.comment) : "";
      return [entry.date, ...responses, comment];
    });

    // CSV escaping: wrap in quotes, double internal quotes
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadFile("tracker-data.csv", csv, "text/csv");
  });

  // Import JSON (entries list OR backup object)
  importJSONInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    try {
      const imported = JSON.parse(text);

      let importedEntries = null;
      let importedQuestions = null;

      if (Array.isArray(imported)) {
        // raw entries array
        importedEntries = imported;
      } else if (imported && typeof imported === "object") {
        // backup object
        if (Array.isArray(imported.entries)) importedEntries = imported.entries;
        if (Array.isArray(imported.questions)) importedQuestions = imported.questions;
      }

      if (!Array.isArray(importedEntries)) {
        alert("Invalid file format. Expected an entries list or a backup object.");
        return;
      }

      // Merge questions if provided (incoming wins by id)
      if (Array.isArray(importedQuestions)) {
        const currentQs = loadQuestions();
        const incoming = importedQuestions.map(normaliseQuestion);

        const merged = new Map();
        currentQs.forEach(q => merged.set(q.id, q));
        incoming.forEach(q => merged.set(q.id, q));

        saveQuestions(Array.from(merged.values()));
      }

      // Normalise entries (this is where comment becomes safe across versions)
      saveEntries(importedEntries.map(normaliseEntry));

      refresh?.();
      alert("Import successful!");
    } catch (err) {
      console.error(err);
      alert("Could not read JSON file.");
    } finally {
      event.target.value = "";
    }
  });
}
