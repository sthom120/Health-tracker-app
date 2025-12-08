/* ============================================================
   CUSTOM TRACKER – main.js
   ============================================================
   Controls all pages:
   1. index.html → Setup questions, data controls, PIN settings
   2. track.html → Enter daily data (with edit support)
   3. view.html  → View, filter, summarize, compare & export data
   ============================================================ */


/* ============================================================
   1️⃣  SETUP PAGE – Create / Delete / Reorder Questions
   ============================================================ */
if (document.getElementById("questionForm")) {
  // ---------- DOM elements ----------
  const form = document.getElementById("questionForm");
  const list = document.getElementById("questionList");
  const goTrack = document.getElementById("goTrack");
  const questionType = document.getElementById("questionType");
  const optionsContainer = document.getElementById("optionsContainer");
  const optionsInput = document.getElementById("questionOptions");
  const deleteAllQuestions = document.getElementById("deleteAllQuestions");
  const deleteAllData = document.getElementById("deleteAllData");

  // ---------- Greeting + theme ----------
  const greetingText = document.getElementById("greetingText");
  const hour = new Date().getHours();

  if (greetingText) {
    let greeting = "";
    let subtext = "";
    let themeClass = "";

    if (hour < 12) {
      greeting = "Good morning";
      subtext = "Let's set the tone for a good day.";
      themeClass = "theme-morning";
    } else if (hour < 18) {
      greeting = "Good afternoon";
      subtext = "A great time to check in with yourself.";
      themeClass = "theme-afternoon";
    } else {
      greeting = "Good evening";
      subtext = "Reflect and unwind — how was today?";
      themeClass = "theme-evening";
    }

    greetingText.innerHTML = `
      <h1>${greeting}</h1>
      <p id="greetingSub">${subtext}</p>
    `;
    document.body.classList.add(themeClass);
  }

  // ---------- Load existing questions ----------
  let questions = JSON.parse(localStorage.getItem("questions") || "[]");

  // ---------- Helper: move item in array ----------
  function moveItem(array, from, to) {
    const item = array.splice(from, 1)[0];
    array.splice(to, 0, item);
  }

  // ---------- Render question list ----------
  function renderList() {
    list.innerHTML = "";

    if (!questions.length) {
      list.innerHTML = "<li><em>No questions added yet.</em></li>";
      return;
    }

    questions.forEach((q, index) => {
      const li = document.createElement("li");

      // Left: label / info
      const infoSpan = document.createElement("span");
      let extra = "";
      if (q.type === "select" && q.options) {
        extra = ` [${q.options.join(", ")}]`;
      }
      infoSpan.textContent = `${index + 1}. ${q.text} (${q.type})${extra}`;
      li.appendChild(infoSpan);

      // Right: actions
      const actionsDiv = document.createElement("div");
      actionsDiv.classList.add("question-actions");

      const upBtn = document.createElement("button");
      upBtn.textContent = "↑";
      upBtn.title = "Move up";
      upBtn.classList.add("reorder-btn");

      const downBtn = document.createElement("button");
      downBtn.textContent = "↓";
      downBtn.title = "Move down";
      downBtn.classList.add("reorder-btn");

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.classList.add("small-delete-btn");

      // Attach events
      upBtn.addEventListener("click", () => {
        if (index === 0) return;
        moveItem(questions, index, index - 1);
        localStorage.setItem("questions", JSON.stringify(questions));
        renderList();
      });

      downBtn.addEventListener("click", () => {
        if (index === questions.length - 1) return;
        moveItem(questions, index, index + 1);
        localStorage.setItem("questions", JSON.stringify(questions));
        renderList();
      });

      delBtn.addEventListener("click", () => deleteQuestion(q.id));

      actionsDiv.appendChild(upBtn);
      actionsDiv.appendChild(downBtn);
      actionsDiv.appendChild(delBtn);
      li.appendChild(actionsDiv);

      list.appendChild(li);
    });
  }

  // ---------- Delete a single question ----------
  function deleteQuestion(id) {
    if (!confirm("Delete this question and remove it from all entries?")) return;

    // Remove from list of questions
    questions = questions.filter(q => q.id !== id);
    localStorage.setItem("questions", JSON.stringify(questions));

    // Remove that question’s data from every saved entry
    const entries = JSON.parse(localStorage.getItem("entries") || "[]");
    entries.forEach(e => {
      if (e.responses) delete e.responses[id];
    });
    localStorage.setItem("entries", JSON.stringify(entries));

    renderList();
    alert("Question deleted.");
  }

  // ---------- Show extra input for select options ----------
  questionType.addEventListener("change", () => {
    optionsContainer.style.display =
      questionType.value === "select" ? "block" : "none";
  });

  // ---------- Add new question ----------
  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = document.getElementById("questionText").value.trim();
    const type = questionType.value;
    const opts = optionsInput.value.trim();
    if (!text) return;

    const question = { id: Date.now().toString(), text, type };
    if (type === "select" && opts) {
      question.options = opts.split(",").map(o => o.trim());
    }

    questions.push(question);
    localStorage.setItem("questions", JSON.stringify(questions));
    renderList();
    form.reset();
    optionsContainer.style.display = "none";
  });

  // ---------- Delete ALL questions + data ----------
  deleteAllQuestions.addEventListener("click", () => {
    if (!confirm("Delete ALL questions and related data?")) return;
    localStorage.removeItem("questions");
    localStorage.removeItem("entries");
    questions = [];
    renderList();
    alert("All questions and data cleared.");
  });

  // ---------- Delete ONLY recorded data ----------
  deleteAllData.addEventListener("click", () => {
    if (!confirm("Delete ALL recorded entries (keep questions)?")) return;
    localStorage.removeItem("entries");
    alert("All recorded data cleared.");
  });

  renderList();

  // ---------- Navigate to daily form ----------
  goTrack.addEventListener("click", () => {
    window.location.href = "track.html";
  });

  const quickTrackBtn = document.getElementById("quickTrackBtn");
  if (quickTrackBtn) {
    quickTrackBtn.addEventListener("click", () => {
      window.location.href = "track.html";
    });
  }
}


/* ============================================================
   2️⃣  TRACK PAGE – Record / Edit Daily Data
   ============================================================ */
if (document.getElementById("dailyForm")) {
  const questions = JSON.parse(localStorage.getItem("questions") || "[]");
  const form = document.getElementById("dailyForm");
  const saveBtn = document.getElementById("saveEntry");
  const goView = document.getElementById("goView");
  const dateField = document.getElementById("entryDate");

  // Helper: create a unique entry ID
  function createEntryId() {
    return "e_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  // Edit mode detection
  const params = new URLSearchParams(window.location.search);
  const isEditing = params.has("edit");
  let entries = JSON.parse(localStorage.getItem("entries") || "[]");
  const editEntryId = sessionStorage.getItem("editEntryId") || null;
  let entryToEdit = null;

  if (isEditing && editEntryId) {
    entryToEdit = entries.find(e => e.id === editEntryId) || null;
  }

  // Build the dynamic form for questions
  questions.forEach(q => {
    const card = document.createElement("div");
    card.classList.add("entry-card");

    const fieldLabel = document.createElement("label");
    fieldLabel.textContent = q.text + ": ";

    let input;
    switch (q.type) {
      case "boolean": {
        input = document.createElement("select");
        input.innerHTML =
          "<option value='true'>Yes</option><option value='false'>No</option>";
        break;
      }
      case "number": {
        input = document.createElement("input");
        input.type = "number";
        input.min = 0;
        input.max = 10;
        break;
      }
      case "date": {
        input = document.createElement("input");
        input.type = "date";
        break;
      }
      case "select": {
        input = document.createElement("div");
        input.classList.add("multi-select-group");
        (q.options || []).forEach(opt => {
          const optLabel = document.createElement("label");
          optLabel.classList.add("checkbox-option");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.name = q.id;
          checkbox.value = opt;
          optLabel.appendChild(checkbox);
          optLabel.append(" " + opt);
          input.appendChild(optLabel);
        });
        break;
      }
      default: {
        input = document.createElement("input");
        input.type = "text";
      }
    }

    if (q.type !== "select") {
      input.name = q.id;
    }

    fieldLabel.appendChild(input);
    card.appendChild(fieldLabel);
    form.appendChild(card);
  });

  // Auto-fill date: edit → existing date, otherwise today
  if (entryToEdit) {
    if (dateField) dateField.value = entryToEdit.date;
    saveBtn.textContent = "Update Entry";
  } else if (dateField && !dateField.value) {
    dateField.value = new Date().toISOString().split("T")[0];
  }

  // Pre-fill responses in edit mode
  if (entryToEdit && entryToEdit.responses) {
    questions.forEach(q => {
      const value = entryToEdit.responses[q.id];

      if (q.type === "boolean") {
        if (form.elements[q.id]) {
          form.elements[q.id].value = value ? "true" : "false";
        }
      } else if (q.type === "select") {
        const selected = Array.isArray(value) ? value : [];
        selected.forEach(v => {
          const box = form.querySelector(
            `input[name="${q.id}"][value="${v}"]`
          );
          if (box) box.checked = true;
        });
      } else if (value !== undefined && form.elements[q.id]) {
        form.elements[q.id].value = value;
      }
    });
  }

  // Save / update entry
  saveBtn.addEventListener("click", () => {
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");

    const entryDate =
      dateField.value || new Date().toISOString().split("T")[0];

    const data = { date: entryDate, responses: {} };

    questions.forEach(q => {
      let val;
      if (q.type === "boolean") {
        val = form.elements[q.id]?.value === "true";
      } else if (q.type === "select") {
        const checked = Array.from(
          form.querySelectorAll(`input[name="${q.id}"]:checked`)
        ).map(cb => cb.value);
        val = checked;
      } else {
        val = form.elements[q.id]?.value || "";
      }
      data.responses[q.id] = val;
    });

    if (entryToEdit) {
      const idx = entries.findIndex(e => e.id === entryToEdit.id);
      if (idx !== -1) {
        entries[idx] = { ...data, id: entryToEdit.id };
      } else {
        entries.push({ ...data, id: createEntryId() });
      }
      sessionStorage.removeItem("editEntryId");
    } else {
      entries.push({ ...data, id: createEntryId() });
    }

    localStorage.setItem("entries", JSON.stringify(entries));
    form.reset();

    const msg = document.getElementById("saveMessage");
    if (msg) {
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2500);
    } else {
      alert("Entry saved!");
    }

    // After update, restore today's date for a fresh entry
    if (!entryToEdit && dateField) {
      dateField.value = new Date().toISOString().split("T")[0];
    }
  });

  // Navigate to data view
  goView.addEventListener("click", () => {
    window.location.href = "view.html";
  });
}


/* ============================================================
   3️⃣  VIEW PAGE – Display, Summarise, Compare, Export
   ============================================================ */
if (document.getElementById("dataTable")) {
  const table = document.getElementById("dataTable");
  const timeframeSelect = document.getElementById("timeframeSelect");
  const summaryContainer = document.getElementById("summaryCards");

  // ---------- Load questions ----------
  const questions = JSON.parse(localStorage.getItem("questions") || "[]");

  // ---------- Load & normalise entries (ensure IDs) ----------
  function loadEntries() {
    const raw = JSON.parse(localStorage.getItem("entries") || "[]");
    let changed = false;

    raw.forEach(e => {
      if (!e.id) {
        e.id =
          "e_" + Date.now() + "_" + Math.random().toString(16).slice(2);
        changed = true;
      }
      if (!e.responses) {
        e.responses = {};
      }
    });

    if (changed) {
      localStorage.setItem("entries", JSON.stringify(raw));
    }

    return raw;
  }

  let entries = loadEntries();

  // ---------- Time filtering helpers ----------
  function filterEntriesByTimeframe(days) {
    if (days === "all") return [...entries];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));
    return entries.filter(e => new Date(e.date) >= cutoff);
  }

  function getFilteredEntries() {
    const selected = timeframeSelect ? timeframeSelect.value : "all";
    const filtered = filterEntriesByTimeframe(selected);
    return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", () => {
      renderTable();
      renderSummary();
    });
  }

  // ---------- Render table ----------
  function renderTable() {
    table.innerHTML = "";

    // Header row
    const header = document.createElement("tr");
    const headerCells = ["Date", ...questions.map(q => q.text), "Actions"];
    headerCells.forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      header.appendChild(th);
    });
    table.appendChild(header);

    const allEntries = getFilteredEntries();

    allEntries.forEach(entry => {
      const row = document.createElement("tr");

      // Date cell
      const dateCell = document.createElement("td");
      dateCell.textContent = entry.date;
      row.appendChild(dateCell);

      // Question response cells
      questions.forEach(q => {
        const cell = document.createElement("td");
        const val = entry.responses ? entry.responses[q.id] : "";
        cell.textContent = Array.isArray(val)
          ? val.join(", ")
          : val ?? "";
        row.appendChild(cell);
      });

      // Actions cell
      const actionsCell = document.createElement("td");

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.classList.add("small-edit");
      editBtn.dataset.entryId = entry.id;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("danger", "small-delete");
      deleteBtn.dataset.entryId = entry.id;

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
      row.appendChild(actionsCell);

      // Edit handler
      editBtn.addEventListener("click", () => {
        sessionStorage.setItem("editEntryId", entry.id);
        window.location.href = "track.html?edit=1";
      });

      // Delete handler
      deleteBtn.addEventListener("click", () => {
        if (!confirm("Delete this entry?")) return;
        entries = entries.filter(e => e.id !== entry.id);
        localStorage.setItem("entries", JSON.stringify(entries));
        renderTable();
        renderSummary();
        alert("Entry deleted!");
      });

      table.appendChild(row);
    });
  }

  renderTable();

  // ---------- Summary cards (last 7 / 30 days) ----------
  function entriesInLast(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return entries.filter(e => new Date(e.date) >= cutoff);
  }

  function completionRate(list) {
    if (!list.length || !questions.length) return 0;
    const totalSlots = list.length * questions.length;
    let filled = 0;

    list.forEach(entry => {
      questions.forEach(q => {
        const v = entry.responses ? entry.responses[q.id] : "";
        if (Array.isArray(v)) {
          if (v.length) filled++;
        } else if (v !== "" && v !== null && v !== undefined) {
          filled++;
        }
      });
    });

    return Math.round((filled / totalSlots) * 100);
  }

  function renderSummary() {
    if (!summaryContainer) return;

    const week = entriesInLast(7);
    const month = entriesInLast(30);

    summaryContainer.innerHTML = `
      <div class="summary-card">
        <h3>Last 7 Days</h3>
        <p>Entries logged: <strong>${week.length}</strong></p>
        <p>Average completion: <strong>${completionRate(week)}%</strong></p>
      </div>

      <div class="summary-card">
        <h3>Last 30 Days</h3>
        <p>Entries logged: <strong>${month.length}</strong></p>
        <p>Average completion: <strong>${completionRate(month)}%</strong></p>
      </div>
    `;
  }

  renderSummary();

  /* ============================================================
     MULTI-FACTOR COMPARISON CHART
     ============================================================ */
  const factorASelect = document.getElementById("factorA");
  const factorBSelect = document.getElementById("factorB");
  const optionsA = document.getElementById("optionsA");
  const optionsB = document.getElementById("optionsB");
  const compareBtn = document.getElementById("compareBtn");
  const clearChartBtn = document.getElementById("clearChartBtn");
  const compareCanvas = document.getElementById("compareChart");
  let currentChart = null;

  function renderOptionPicker(container, question) {
    container.innerHTML = "";
    if (question && question.type === "select" && question.options) {
      const heading = document.createElement("p");
      heading.textContent = "Include options:";
      container.appendChild(heading);
      question.options.forEach(opt => {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = opt;
        cb.checked = true;
        label.appendChild(cb);
        label.append(" " + opt);
        container.appendChild(label);
      });
    }
  }

  if (factorASelect && factorBSelect) {
    questions.forEach(q => {
      const optA = new Option(q.text, q.id);
      const optB = new Option(q.text, q.id);
      factorASelect.appendChild(optA);
      factorBSelect.appendChild(optB);
    });

    factorASelect.addEventListener("change", () =>
      renderOptionPicker(
        optionsA,
        questions.find(q => q.id == factorASelect.value)
      )
    );
    factorBSelect.addEventListener("change", () =>
      renderOptionPicker(
        optionsB,
        questions.find(q => q.id == factorBSelect.value)
      )
    );

    function normalizeValue(val) {
      if (val === true || val === "true") return 10;
      if (val === false || val === "false") return 0;
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    }

    compareBtn.addEventListener("click", () => {
      const idA = factorASelect.value;
      const idB = factorBSelect.value;
      if (!idA || !idB || idA === idB) {
        alert("Please choose two different questions.");
        return;
      }

      const sortedEntries = getFilteredEntries();
      const labels = sortedEntries.map(e => e.date);
      const qA = questions.find(q => q.id == idA);
      const qB = questions.find(q => q.id == idB);
      const datasets = [];

      const selectedOptsA = Array.from(
        optionsA.querySelectorAll("input:checked")
      ).map(c => c.value);
      const selectedOptsB = Array.from(
        optionsB.querySelectorAll("input:checked")
      ).map(c => c.value);

      // Question A
      if (qA.type === "select" && qA.options) {
        qA.options.forEach((opt, idx) => {
          if (!selectedOptsA.includes(opt)) return;
          const data = sortedEntries.map(e =>
            Array.isArray(e.responses[idA])
              ? e.responses[idA].includes(opt) ? 1 : 0
              : 0
          );
          datasets.push({
            label: `${qA.text}: ${opt}`,
            data,
            borderColor: `hsl(${idx * 80},70%,50%)`,
            borderWidth: 2,
            fill: false,
            yAxisID: "y2"
          });
        });
      } else {
        const data = sortedEntries.map(e =>
          normalizeValue(e.responses[idA])
        );
        datasets.push({
          label: qA.text,
          data,
          borderColor: "rgba(255,99,132,1)",
          borderWidth: 2,
          fill: false
        });
      }

      // Question B
      if (qB.type === "select" && qB.options) {
        qB.options.forEach((opt, idx) => {
          if (!selectedOptsB.includes(opt)) return;
          const data = sortedEntries.map(e =>
            Array.isArray(e.responses[idB])
              ? e.responses[idB].includes(opt) ? 1 : 0
              : 0
          );
          datasets.push({
            label: `${qB.text}: ${opt}`,
            data,
            borderColor: `hsl(${180 + idx * 80},70%,50%)`,
            borderWidth: 2,
            fill: false,
            yAxisID: "y2"
          });
        });
      } else {
        const data = sortedEntries.map(e =>
          normalizeValue(e.responses[idB])
        );
        datasets.push({
          label: qB.text,
          data,
          borderColor: "rgba(54,162,235,1)",
          borderWidth: 2,
          fill: false
        });
      }

      if (currentChart) currentChart.destroy();

      currentChart = new Chart(compareCanvas, {
        type: "line",
        data: { labels, datasets },
        options: {
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "top" } },
          scales: {
            x: {
              title: {
                display: true,
                text: "Date (oldest → newest)"
              }
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Numeric Values" }
            },
            y2: {
              position: "right",
              beginAtZero: true,
              max: 1,
              title: {
                display: true,
                text: "Select Option Presence (0/1)"
              },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    });

    clearChartBtn.addEventListener("click", () => {
      if (currentChart) currentChart.destroy();
      currentChart = null;
      optionsA.innerHTML = "";
      optionsB.innerHTML = "";
      factorASelect.value = "";
      factorBSelect.value = "";
    });
  }

  /* ============================================================
     EXPORT / IMPORT DATA (JSON + CSV)
     ============================================================ */
  const exportJSONBtn = document.getElementById("exportJSON");
  const exportCSVBtn = document.getElementById("exportCSV");
  const importJSONInput = document.getElementById("importJSON");

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportJSONBtn?.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem("entries") || "[]");
    if (!data.length) return alert("No entries to export.");
    const json = JSON.stringify(data, null, 2);
    downloadFile("tracker-data.json", json, "application/json");
  });

  exportCSVBtn?.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem("entries") || "[]");
    if (!data.length) return alert("No entries to export.");

    const questions = JSON.parse(localStorage.getItem("questions") || "[]");
    const headers = ["Date", ...questions.map(q => q.text)];
    const rows = data.map(entry => {
      const responses = questions.map(q => {
        const val = entry.responses ? entry.responses[q.id] : "";
        return Array.isArray(val) ? val.join(", ") : val ?? "";
      });
      return [entry.date, ...responses];
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadFile("tracker-data.csv", csv, "text/csv");
  });

  importJSONInput?.addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) {
        alert("Invalid file format. Expected a list of entries.");
        return;
      }

      localStorage.setItem("entries", JSON.stringify(imported));
      entries = loadEntries(); // normalise + refresh
      renderTable();
      renderSummary();
      alert("Import successful!");
    } catch (err) {
      console.error(err);
      alert("Could not read JSON file.");
    } finally {
      event.target.value = "";
    }
  });
}


/* ============================================================
   4️⃣  PIN SETTINGS MODAL (Change / Remove PIN)
   ============================================================ */

async function hashPIN(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

(function setupPinModal() {
  const pinModal = document.getElementById("pinModal");
  const pinModalTitle = document.getElementById("pinModalTitle");
  const pinModalMessage = document.getElementById("pinModalMessage");
  const pinInput = document.getElementById("pinInput");
  const newPinFields = document.getElementById("newPinFields");
  const newPin1 = document.getElementById("newPin1");
  const newPin2 = document.getElementById("newPin2");
  const confirmBtn = document.getElementById("pinModalConfirm");
  const cancelBtn = document.getElementById("pinModalCancel");
  const changePinBtn = document.getElementById("changePinBtn");
  const removePinBtn = document.getElementById("removePinBtn");

  if (
    !pinModal ||
    !pinModalTitle ||
    !pinModalMessage ||
    !pinInput ||
    !newPinFields ||
    !newPin1 ||
    !newPin2 ||
    !confirmBtn ||
    !cancelBtn
  ) {
    // We’re not on the index page – nothing to wire up.
    return;
  }

  let pinMode = ""; // "change", "remove", "change-final"

  function openPinModal(mode) {
    pinMode = mode;
    pinInput.value = "";
    newPin1.value = "";
    newPin2.value = "";
    newPinFields.classList.add("hidden");

    if (mode === "change") {
      pinModalTitle.textContent = "Change PIN";
      pinModalMessage.textContent = "Enter your current 4-digit PIN";
    } else if (mode === "remove") {
      pinModalTitle.textContent = "Remove PIN";
      pinModalMessage.textContent =
        "Enter your current 4-digit PIN to remove the lock";
    }

    pinModal.classList.remove("hidden");
  }

  changePinBtn?.addEventListener("click", () => openPinModal("change"));
  removePinBtn?.addEventListener("click", () => openPinModal("remove"));

  cancelBtn.addEventListener("click", () => {
    pinModal.classList.add("hidden");
  });

  confirmBtn.addEventListener("click", async () => {
    const entered = pinInput.value;
    const savedHash = localStorage.getItem("pinHash");

    if (!savedHash) {
      alert("No PIN is currently set.");
      pinModal.classList.add("hidden");
      return;
    }

    const enteredHash = await hashPIN(entered);
    if (enteredHash !== savedHash) {
      alert("Incorrect PIN.");
      return;
    }

    // Correct PIN:
    if (pinMode === "remove") {
      localStorage.removeItem("pinHash");
      alert("PIN removed.");
      pinModal.classList.add("hidden");
      return;
    }

    if (pinMode === "change") {
      newPinFields.classList.remove("hidden");
      pinModalMessage.textContent = "Enter your new 4-digit PIN and confirm";
      pinMode = "change-final";
      return;
    }

    if (pinMode === "change-final") {
      if (newPin1.value.length !== 4 || isNaN(Number(newPin1.value))) {
        alert("PIN must be exactly 4 digits.");
        return;
      }
      if (newPin1.value !== newPin2.value) {
        alert("PINs do not match.");
        return;
      }

      const newHash = await hashPIN(newPin1.value);
      localStorage.setItem("pinHash", newHash);
      alert("PIN changed successfully.");
      pinModal.classList.add("hidden");
    }
  });
})();
