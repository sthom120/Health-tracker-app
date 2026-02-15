// js/exportImport.js
import { loadEntries, loadQuestions, saveEntries, saveQuestions, normaliseEntry, normaliseQuestion, nowISO, formatQuestionLabel } from "./storage.js";

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

  exportJSONBtn?.addEventListener("click", () => {
    const entries = loadEntries();
    const questions = loadQuestions();

    if (!entries.length) return alert("No entries to export.");

    const backup = {
      exportVersion: 2,
      exportedAt: nowISO(),
      questions,
      entries,
    };

    downloadFile("tracker-backup.json", JSON.stringify(backup, null, 2), "application/json");
  });

  exportCSVBtn?.addEventListener("click", () => {
    const entries = loadEntries();
    if (!entries.length) return alert("No entries to export.");

    const qs = getQuestionsForView();
    const headers = ["Date", ...qs.map(q => formatQuestionLabel(q))];

    const rows = entries.map(entry => {
      const responses = qs.map(q => {
        const val = entry.responses ? entry.responses[q.id] : "";
        if (val === null) return "";
        return Array.isArray(val) ? val.join(", ") : (val ?? "");
      });
      return [entry.date, ...responses];
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadFile("tracker-data.csv", csv, "text/csv");
  });

  importJSONInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    try {
      const imported = JSON.parse(text);

      let importedEntries = null;
      let importedQuestions = null;

      if (Array.isArray(imported)) {
        importedEntries = imported;
      } else if (imported && typeof imported === "object") {
        if (Array.isArray(imported.entries)) importedEntries = imported.entries;
        if (Array.isArray(imported.questions)) importedQuestions = imported.questions;
      }

      if (!Array.isArray(importedEntries)) {
        alert("Invalid file format. Expected an entries list or a backup object.");
        return;
      }

      if (Array.isArray(importedQuestions)) {
        const currentQs = loadQuestions();
        const incoming = importedQuestions.map(normaliseQuestion);

        // merge by id (incoming wins)
        const merged = new Map();
        currentQs.forEach(q => merged.set(q.id, q));
        incoming.forEach(q => merged.set(q.id, q));
        saveQuestions(Array.from(merged.values()));
      }

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
