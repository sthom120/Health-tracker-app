// js/view.js
// ------------------------------------------------------------
// View page logic (view.html)
//
// Responsibilities:
// - Load questions + entries from storage
// - Filter entries by timeframe
// - Render entries table (includes Comment column)
// - Provide Edit/Delete controls per entry
// - Render lightweight summary cards
// - Init chart comparison UI (charts.js)
// - Init export/import UI (exportImport.js)
//
// NOTE TO SELF:
// Keep storage formats + normalisation inside storage.js.
// ------------------------------------------------------------

import {
  loadEntries,
  saveEntries,
  loadQuestions,
  parseLocalDate,
  formatQuestionLabel,
} from "./storage.js";

import { initCompareChart } from "./charts.js";
import { initExportImport } from "./exportImport.js";

/* ------------------------------------------------------------
   Page guards
------------------------------------------------------------ */
function initViewPage() {
  const tableEl = document.getElementById("dataTable");
  if (!tableEl) return; // not on view page

  // Controls / containers
  const timeframeSelect = document.getElementById("timeframeSelect");
  const summaryCards = document.getElementById("summaryCards");

  // In-memory working state (reloaded in refresh when needed)
  let questions = loadQuestions();
  let entries = loadEntries();

  /* ----------------------------------------------------------
     Helpers
  ---------------------------------------------------------- */

  // What questions should appear in the table + chart dropdowns?
  // NOTE TO SELF: You can change this to include archived questions if you want.
  function getQuestionsForView() {
    questions = loadQuestions();
    return questions.filter(q => !q.archived);
  }

  // Sort entries oldest -> newest (more intuitive for charts + tables)
  function sortEntriesByDate(list) {
    return [...list].sort((a, b) => {
      const da = parseLocalDate(a.date);
      const db = parseLocalDate(b.date);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });
  }

  // Timeframe filter: "all" or number of days
  function getFilteredEntries() {
    entries = loadEntries();

    const sorted = sortEntriesByDate(entries);

    const tf = timeframeSelect?.value || "all";
    if (tf === "all") return sorted;

    const days = Number(tf);
    if (!Number.isFinite(days) || days <= 0) return sorted;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1)); // include today as day 1

    return sorted.filter(e => {
      const d = parseLocalDate(e.date);
      return d && d >= cutoff;
    });
  }

  /* ----------------------------------------------------------
     Table rendering
  ---------------------------------------------------------- */
  function renderTable() {
    const qs = getQuestionsForView();
    const filtered = getFilteredEntries();

    // Table header
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    // Always show Date first
    const thDate = document.createElement("th");
    thDate.textContent = "Date";
    headRow.appendChild(thDate);

    // One column per question
    qs.forEach(q => {
      const th = document.createElement("th");
      th.textContent = formatQuestionLabel(q);
      headRow.appendChild(th);
    });

    // NEW: Comment column
    const thComment = document.createElement("th");
    thComment.textContent = "Comment";
    headRow.appendChild(thComment);

    // Actions column
    const thActions = document.createElement("th");
    thActions.textContent = "Actions";
    headRow.appendChild(thActions);

    thead.appendChild(headRow);

    // Table body
    const tbody = document.createElement("tbody");

    if (!filtered.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 2 + qs.length; // Date + Comment + questions (+ actions)
      td.innerHTML = "<em>No entries yet for this timeframe.</em>";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      filtered.forEach(entry => {
        const tr = document.createElement("tr");

        // Date
        const tdDate = document.createElement("td");
        tdDate.textContent = entry.date || "";
        tr.appendChild(tdDate);

        // Responses
        qs.forEach(q => {
          const td = document.createElement("td");
          const val = entry.responses ? entry.responses[q.id] : "";

          if (val === null || val === undefined || val === "") {
            td.textContent = "";
          } else if (Array.isArray(val)) {
            td.textContent = val.join(", ");
          } else if (val === true) {
            td.textContent = "Yes";
          } else if (val === false) {
            td.textContent = "No";
          } else {
            td.textContent = String(val);
          }

          tr.appendChild(td);
        });

        // Comment
        const tdComment = document.createElement("td");
        tdComment.textContent = entry.comment ? String(entry.comment) : "";
        tr.appendChild(tdComment);

        // Actions
        const tdActions = document.createElement("td");
        tdActions.classList.add("table-actions");

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.classList.add("small-edit-btn");
        editBtn.textContent = "Edit";

        editBtn.addEventListener("click", () => {
          // NOTE TO SELF:
          // Track page reads this in edit mode.
          sessionStorage.setItem("editEntryId", entry.id);
          window.location.href = "track.html?edit=1";
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.classList.add("small-delete-btn");
        delBtn.textContent = "Delete";

        delBtn.addEventListener("click", () => {
          if (!confirm(`Delete entry for ${entry.date}? This cannot be undone.`)) return;

          const all = loadEntries();
          const next = all.filter(e => e.id !== entry.id);
          saveEntries(next);

          refresh();
        });

        tdActions.append(editBtn, delBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    }

    // Replace table content
    tableEl.innerHTML = "";
    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);
  }

  /* ----------------------------------------------------------
     Summary rendering (simple + useful)
  ---------------------------------------------------------- */
  function renderSummary() {
    if (!summaryCards) return;

    const filtered = getFilteredEntries();

    // Days logged = unique dates in filtered set
    const uniqueDates = new Set(filtered.map(e => e.date)).size;

    // Most recent entry date (filtered)
    const mostRecent = filtered.length ? filtered[filtered.length - 1].date : "—";

    // Total entries overall (not just filtered)
    const total = loadEntries().length;

    summaryCards.innerHTML = "";

    const cards = [
      { title: "Entries (this view)", value: String(filtered.length) },
      { title: "Days logged (this view)", value: String(uniqueDates) },
      { title: "Most recent entry", value: mostRecent },
      { title: "Total entries (all time)", value: String(total) },
    ];

    cards.forEach(c => {
      const card = document.createElement("div");
      card.classList.add("summary-card");

      const h = document.createElement("h3");
      h.textContent = c.title;

      const p = document.createElement("p");
      p.textContent = c.value;

      card.append(h, p);
      summaryCards.appendChild(card);
    });
  }

  /* ----------------------------------------------------------
     Refresh everything (table + summary + chart/export helpers)
  ---------------------------------------------------------- */
  function refresh() {
    // Re-read fresh data
    questions = loadQuestions();
    entries = loadEntries();

    renderTable();
    renderSummary();

    // NOTE TO SELF:
    // Chart + export/import init are safe to call once,
    // so we only initialise them on first run.
  }

  /* ----------------------------------------------------------
     Wire timeframe changes -> re-render view
  ---------------------------------------------------------- */
  timeframeSelect?.addEventListener("change", () => {
    renderTable();
    renderSummary();
    // Charts read from getFilteredEntries(), so no extra work needed.
  });

  /* ----------------------------------------------------------
     Init: render view + init modules
  ---------------------------------------------------------- */
  refresh();

  // Comparison chart module (uses callbacks for latest filtered data)
  initCompareChart({
    getFilteredEntries,
    getQuestionsForView,
  });

  // Export / Import module (uses callbacks for latest question set)
  initExportImport({
    getQuestionsForView,
    refresh,
  });
}

initViewPage();
