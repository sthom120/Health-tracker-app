/* ============================================================
   CUSTOM TRACKER – main.js
   ============================================================
   This script controls all pages:
   1. index.html → Setup questions and data controls
   2. track.html → Enter daily data (manual date)
   3. view.html  → View, filter, and correlate data
   ============================================================ */


/* ============================================================
   1️⃣  SETUP PAGE – Create / Delete Questions
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


  // Personalized greeting + tone
const greetingText = document.getElementById("greetingText");
const hour = new Date().getHours();

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

if (greetingText) {
  greetingText.innerHTML = `
    <h1>${greeting}</h1>
    <p id="greetingSub">${subtext}</p>
  `;
  document.body.classList.add(themeClass);
}



  // ---------- Load existing questions ----------
  let questions = JSON.parse(localStorage.getItem("questions") || "[]");


  // ---------- Render question list ----------
  function renderList() {
    list.innerHTML = "";
    if (questions.length === 0) {
      list.innerHTML = "<li><em>No questions added yet.</em></li>";
      return;
    }
    questions.forEach((q, i) => {
      const li = document.createElement("li");
      let extra = "";
      if (q.type === "select" && q.options)
        extra = ` [${q.options.join(", ")}]`;
      li.textContent = `${i + 1}. ${q.text} (${q.type})${extra}`;

      // Add small "Delete" button next to each question
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.style.marginLeft = "0.5em";
      delBtn.onclick = () => deleteQuestion(q.id);
      li.appendChild(delBtn);
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
    entries.forEach(e => delete e.responses[id]);
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

    const question = { id: Date.now(), text, type };
    if (type === "select" && opts)
      question.options = opts.split(",").map(o => o.trim());

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
}

const quickTrackBtn = document.getElementById("quickTrackBtn");
if (quickTrackBtn) {
  quickTrackBtn.addEventListener("click", () => {
    window.location.href = "track.html";
  });
}


/* ============================================================
   2️⃣  TRACK PAGE – Record Daily Data
   ============================================================ */
if (document.getElementById("dailyForm")) {
  // ---------- Load questions ----------
  const questions = JSON.parse(localStorage.getItem("questions") || "[]");
  const form = document.getElementById("dailyForm");
  const saveBtn = document.getElementById("saveEntry");
  const goView = document.getElementById("goView");

  // ---------- Dynamically build the form ----------
  questions.forEach(q => {
    // Card container
    const card = document.createElement("div");
    card.classList.add("entry-card");

    // Label for the field
    const fieldLabel = document.createElement("label");
    fieldLabel.textContent = q.text + ": ";

    let input;
    switch (q.type) {
      case "boolean": {
        input = document.createElement("select");
        input.innerHTML = "<option value='true'>Yes</option><option value='false'>No</option>";
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

    // set name for non-select controls (select uses checkbox group names)
    if (q.type !== "select") input.name = q.id;

    fieldLabel.appendChild(input);
    card.appendChild(fieldLabel);
    form.appendChild(card);
  });

  // ---------- Save entry ----------
  saveBtn.addEventListener("click", () => {
    const entries = JSON.parse(localStorage.getItem("entries") || "[]");

    const entryDate =
      document.getElementById("entryDate").value ||
      new Date().toISOString().split("T")[0];

    const data = { date: entryDate, responses: {} };

    questions.forEach(q => {
      let val;
      if (q.type === "boolean") {
        val = form.elements[q.id].value === "true";
      } else if (q.type === "select") {
        const checked = Array.from(
          form.querySelectorAll(`input[name="${q.id}"]:checked`)
        ).map(cb => cb.value);
        val = checked;
      } else {
        val = form.elements[q.id].value;
      }
      data.responses[q.id] = val;
    });

    localStorage.setItem("entries", JSON.stringify([...entries, data]));
    form.reset();

    const msg = document.getElementById("saveMessage");
    if (msg) {
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2500);
    } else {
      alert("Entry saved!");
    }
  });

  // ---------- Navigate to data view ----------
  goView.addEventListener("click", () => {
    window.location.href = "view.html";
  });
}

/* ============================================================
   3️⃣  VIEW PAGE – Display + Analyze Data
   ============================================================ */
if (document.getElementById("dataTable")) {

  // ---------- Load questions + entries ----------
  const table = document.getElementById("dataTable");
  const backHome = document.getElementById("backHome");
  const questions = JSON.parse(localStorage.getItem("questions") || "[]");
  const entries = JSON.parse(localStorage.getItem("entries") || "[]");
  const timeframeSelect = document.getElementById("timeframeSelect");

  // ---------- Filter helpers ----------
  function filterEntriesByTimeframe(days) {
    if (days === "all") return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));
    return entries.filter(e => new Date(e.date) >= cutoff);
  }

  function getFilteredEntries() {
    const selected = timeframeSelect ? timeframeSelect.value : "all";
    const filtered = filterEntriesByTimeframe(selected);
    return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Re-render table whenever timeframe changes
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", renderTable);
  }

  // ---------- Build table ----------
function renderTable() {
  table.innerHTML = "";
  const header = document.createElement("tr");
  header.innerHTML =
    "<th>Date</th>" +
    questions.map(q => `<th>${q.text}</th>`).join("") +
    "<th>Actions</th>"; // new column for delete
  table.appendChild(header);

  const allEntries = getFilteredEntries();

  allEntries.forEach((e, index) => {
    const row = document.createElement("tr");
    let html = `<td>${e.date}</td>`;
    questions.forEach(q => {
      const val = e.responses[q.id];
      html += `<td>${Array.isArray(val) ? val.join(", ") : (val ?? "")}</td>`;
    });

    // add delete button column
    html += `<td><button class="danger small-delete" data-index="${index}">Delete</button></td>`;
    row.innerHTML = html;
    table.appendChild(row);
  });

  // attach delete button functionality
  table.querySelectorAll(".small-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = btn.dataset.index;
      if (confirm("Delete this entry?")) {
        const entries = JSON.parse(localStorage.getItem("entries") || "[]");
        const filtered = getFilteredEntries();
        const entryToDelete = filtered[index];

        // remove entry by matching date + responses
        const updated = entries.filter(e =>
          !(e.date === entryToDelete.date &&
            JSON.stringify(e.responses) === JSON.stringify(entryToDelete.responses))
        );

        localStorage.setItem("entries", JSON.stringify(updated));
        renderTable();
        alert("Entry deleted!");
      }
    });
  });
}

  renderTable(); // initial display


  /* ============================================================
     MULTI-FACTOR COMPARISON CHART (with filters + clear)
     ============================================================ */
  const factorASelect = document.getElementById("factorA");
  const factorBSelect = document.getElementById("factorB");
  const optionsA = document.getElementById("optionsA");
  const optionsB = document.getElementById("optionsB");
  const compareBtn = document.getElementById("compareBtn");
  const clearChartBtn = document.getElementById("clearChartBtn");
  const compareCanvas = document.getElementById("compareChart");
  let currentChart = null; // store reference so we can clear it

  // Create checkboxes for select-type questions
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

  // Populate dropdowns
  if (factorASelect && factorBSelect) {
    questions.forEach(q => {
      const optA = new Option(q.text, q.id);
      const optB = new Option(q.text, q.id);
      factorASelect.appendChild(optA);
      factorBSelect.appendChild(optB);
    });

    factorASelect.addEventListener("change", () =>
      renderOptionPicker(optionsA, questions.find(q => q.id == factorASelect.value))
    );
    factorBSelect.addEventListener("change", () =>
      renderOptionPicker(optionsB, questions.find(q => q.id == factorBSelect.value))
    );

    // Convert values to numbers for charting
    function normalizeValue(val) {
      if (val === true || val === "true") return 10;
      if (val === false || val === "false") return 0;
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    }

    // Plot chart
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

      const selectedOptsA = Array.from(optionsA.querySelectorAll("input:checked")).map(c => c.value);
      const selectedOptsB = Array.from(optionsB.querySelectorAll("input:checked")).map(c => c.value);

      // Question A
      if (qA.type === "select" && qA.options) {
        qA.options.forEach((opt, idx) => {
          if (!selectedOptsA.includes(opt)) return;
          const data = sortedEntries.map(e => (e.responses[idA] === opt ? 1 : 0));
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
        const data = sortedEntries.map(e => normalizeValue(e.responses[idA]));
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
          const data = sortedEntries.map(e => (e.responses[idB] === opt ? 1 : 0));
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
        const data = sortedEntries.map(e => normalizeValue(e.responses[idB]));
        datasets.push({
          label: qB.text,
          data,
          borderColor: "rgba(54,162,235,1)",
          borderWidth: 2,
          fill: false
        });
      }

      // Clear previous chart if it exists
      if (currentChart) currentChart.destroy();

      // Draw new chart
      currentChart = new Chart(compareCanvas, {
        type: "line",
        data: { labels, datasets },
        options: {
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "top" } },
          scales: {
            x: { title: { display: true, text: "Date (oldest → newest)" } },
            y: { beginAtZero: true, title: { display: true, text: "Numeric Values" } },
            y2: {
              position: "right",
              beginAtZero: true,
              max: 1,
              title: { display: true, text: "Select Option Presence (0/1)" },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    });

    // Clear the chart and reset selections
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
     EXPORT DATA (JSON + CSV)
     ============================================================ */
  const exportJSONBtn = document.getElementById("exportJSON");
  const exportCSVBtn = document.getElementById("exportCSV");

  // ---------- Helper: download a blob ----------
  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Export JSON ----------
  exportJSONBtn?.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem("entries") || "[]");
    if (!data.length) return alert("No entries to export.");
    const json = JSON.stringify(data, null, 2);
    downloadFile("tracker-data.json", json, "application/json");
  });

  // ---------- Export CSV ----------
  exportCSVBtn?.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem("entries") || "[]");
    if (!data.length) return alert("No entries to export.");

    const questions = JSON.parse(localStorage.getItem("questions") || "[]");
    const headers = ["Date", ...questions.map(q => q.text)];
    const rows = data.map(entry => {
      const responses = questions.map(q => entry.responses[q.id] ?? "");
      return [entry.date, ...responses];
    });

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    downloadFile("tracker-data.csv", csv, "text/csv");
  });

  // ---------- Back to setup ----------
  backHome.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}



/* ============================================================
   PIN SETTINGS LOGIC
   ============================================================ */

async function hashPIN(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Modal elements
const pinModal = document.getElementById("pinModal");
const pinModalTitle = document.getElementById("pinModalTitle");
const pinModalMessage = document.getElementById("pinModalMessage");
const pinInput = document.getElementById("pinInput");
const newPinFields = document.getElementById("newPinFields");
const newPin1 = document.getElementById("newPin1");
const newPin2 = document.getElementById("newPin2");

const confirmBtn = document.getElementById("pinModalConfirm");
const cancelBtn = document.getElementById("pinModalCancel");

let pinMode = ""; // "change", "remove"

// Open modal
function openPinModal(mode) {
  pinMode = mode;
  pinInput.value = "";
  newPin1.value = "";
  newPin2.value = "";

  if (mode === "change") {
    pinModalTitle.textContent = "Change PIN";
    pinModalMessage.textContent = "Enter your current PIN";
    newPinFields.classList.add("hidden");
  }

  if (mode === "remove") {
    pinModalTitle.textContent = "Remove PIN";
    pinModalMessage.textContent = "Enter your current PIN to remove the lock";
    newPinFields.classList.add("hidden");
  }

  pinModal.classList.remove("hidden");
}

// Attach to buttons
document.getElementById("changePinBtn")?.addEventListener("click", () =>
  openPinModal("change")
);

document.getElementById("removePinBtn")?.addEventListener("click", () =>
  openPinModal("remove")
);

// Cancel modal
cancelBtn.addEventListener("click", () => {
  pinModal.classList.add("hidden");
});

// Confirm logic
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

  // PIN is correct:
  if (pinMode === "remove") {
    localStorage.removeItem("pinHash");
    alert("PIN removed.");
    pinModal.classList.add("hidden");
    return;
  }

  if (pinMode === "change") {
    // Show new PIN fields
    newPinFields.classList.remove("hidden");
    pinModalMessage.textContent = "Enter new PIN and confirm";
    pinMode = "change-final"; // progress to next stage
    return;
  }

  // Final stage of change
  if (pinMode === "change-final") {
    if (newPin1.value.length < 4 || newPin1.value.length > 6) {
      alert("PIN must be 4–6 digits.");
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
