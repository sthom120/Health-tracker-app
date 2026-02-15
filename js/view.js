// js/view.js
import {
  loadQuestions,
  loadEntries,
  saveEntries,
  parseLocalDate,
  formatQuestionLabel,
  isFilledValue,
} from "./storage.js";

import { initCompareChart } from "./charts.js";
import { initExportImport } from "./exportImport.js";

function initViewPage() {
  const table = document.getElementById("dataTable");
  if (!table) return; // not on view page

  const timeframeSelect = document.getElementById("timeframeSelect");
  const summaryContainer = document.getElementById("summaryCards");

  let questions = loadQuestions();
  let entries = loadEntries();

  function getQuestionsForView() {
    questions = loadQuestions();
    entries = loadEntries();

    const active = questions.filter(q => !q.archived);
    const archived = questions.filter(q => q.archived);

    const archivedWithData = archived.filter(q =>
      entries.some(e => e.responses && e.responses[q.id] !== undefined)
    );

    return [...active, ...archivedWithData];
  }

  function filterEntriesByTimeframe(days) {
    if (days === "all") return [...entries];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));

    return entries.filter(e => {
      const d = parseLocalDate(e.date) || new Date(e.date);
      return d >= cutoff;
    });
  }

  function getFilteredEntries() {
    entries = loadEntries();

    const selected = timeframeSelect ? timeframeSelect.value : "all";
    const filtered = filterEntriesByTimeframe(selected);

    return filtered.sort((a, b) => {
      const da = parseLocalDate(a.date) || new Date(a.date);
      const db = parseLocalDate(b.date) || new Date(b.date);
      return da - db;
    });
  }

  function renderTable() {
    questions = loadQuestions();
    entries = loadEntries();

    const qs = getQuestionsForView();
    const allEntries = getFilteredEntries();

    table.innerHTML = "";

    const header = document.createElement("tr");
    const headers = ["Date", ...qs.map(q => formatQuestionLabel(q)), "Actions"];
    headers.forEach(t => {
      const th = document.createElement("th");
      th.textContent = t;
      header.appendChild(th);
    });
    table.appendChild(header);

    if (!allEntries.length) {
      const row = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length;
      td.innerHTML = "<em>No entries in this timeframe.</em>";
      row.appendChild(td);
      table.appendChild(row);
      return;
    }

    allEntries.forEach(entry => {
      const row = document.createElement("tr");

      const dateCell = document.createElement("td");
      dateCell.textContent = entry.date;
      row.appendChild(dateCell);

      qs.forEach(q => {
        const cell = document.createElement("td");
        const val = entry.responses ? entry.responses[q.id] : "";
        if (val === null) cell.textContent = "";
        else if (Array.isArray(val)) cell.textContent = val.join(", ");
        else cell.textContent = val ?? "";
        row.appendChild(cell);
      });

      const actionsCell = document.createElement("td");

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.classList.add("small-edit");
      editBtn.addEventListener("click", () => {
        sessionStorage.setItem("editEntryId", entry.id);
        window.location.href = "track.html?edit=1";
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("danger", "small-delete");
      deleteBtn.addEventListener("click", () => {
        if (!confirm("Delete this entry?")) return;
        entries = entries.filter(e => e.id !== entry.id);
        saveEntries(entries);
        renderTable();
        renderSummary();
      });

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
      row.appendChild(actionsCell);

      table.appendChild(row);
    });
  }

  function entriesInLast(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return entries.filter(e => {
      const d = parseLocalDate(e.date) || new Date(e.date);
      return d >= cutoff;
    });
  }

  function completionRate(list, qs) {
    if (!list.length || !qs.length) return 0;
    const totalSlots = list.length * qs.length;
    let filled = 0;

    list.forEach(entry => {
      qs.forEach(q => {
        const v = entry.responses ? entry.responses[q.id] : undefined;
        if (isFilledValue(v)) filled++;
      });
    });

    return Math.round((filled / totalSlots) * 100);
  }

  function renderSummary() {
    if (!summaryContainer) return;

    questions = loadQuestions();
    entries = loadEntries();

    const qs = getQuestionsForView();
    const week = entriesInLast(7);
    const month = entriesInLast(30);

    summaryContainer.innerHTML = `
      <div class="summary-card">
        <h3>Last 7 Days</h3>
        <p>Entries logged: <strong>${week.length}</strong></p>
        <p>Average completion: <strong>${completionRate(week, qs)}%</strong></p>
      </div>

      <div class="summary-card">
        <h3>Last 30 Days</h3>
        <p>Entries logged: <strong>${month.length}</strong></p>
        <p>Average completion: <strong>${completionRate(month, qs)}%</strong></p>
      </div>
    `;
  }

  timeframeSelect?.addEventListener("change", () => {
    renderTable();
    renderSummary();
  });

  // Hook up chart + export/import
  initCompareChart({
    getFilteredEntries,
    getQuestionsForView,
  });

  initExportImport({
    getQuestionsForView,
    refresh: () => {
      // after import
      questions = loadQuestions();
      entries = loadEntries();
      renderTable();
      renderSummary();
    },
  });

  renderTable();
  renderSummary();
}

initViewPage();
