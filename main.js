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
    const label = document.createElement("label");
    label.textContent = q.text + ": ";
    let input;

    switch (q.type) {
      case "boolean": // Yes/No dropdown
        input = document.createElement("select");
        input.innerHTML = "<option value='true'>Yes</option><option value='false'>No</option>";
        break;
      case "number": // numeric field
        input = document.createElement("input");
        input.type = "number";
        input.min = 0;
        input.max = 10;
        break;
      case "date": // date picker
        input = document.createElement("input");
        input.type = "date";
        break;
      case "select": // user-defined options (now checkboxes)
  input = document.createElement("div");
  input.classList.add("multi-select-group");

  q.options.forEach(opt => {
    const label = document.createElement("label");
    label.classList.add("checkbox-option");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = q.id;
    checkbox.value = opt;

    label.appendChild(checkbox);
    label.append(" " + opt);
    input.appendChild(label);
  });
  break;
      default: // plain text
        input = document.createElement("input");
        input.type = "text";
    }

    input.name = q.id;
    label.appendChild(input);
    form.appendChild(label);
    form.appendChild(document.createElement("br"));
  });

  // ---------- Save entry ----------
  saveBtn.addEventListener("click", () => {
    const entries = JSON.parse(localStorage.getItem("entries") || "[]");

    // NEW: manual date entry (default to today if left blank)
    const entryDate =
      document.getElementById("entryDate").value ||
      new Date().toISOString().split("T")[0];

    const data = { date: entryDate, responses: {} };

    // Store all answers by question id
    questions.forEach(q => {
  let val;

  if (q.type === "boolean") {
    val = form.elements[q.id].value === "true";
  } else if (q.type === "select") {
    // collect all checked boxes
    const checked = Array.from(form.querySelectorAll(`input[name="${q.id}"]:checked`))
      .map(cb => cb.value);
    val = checked; // array of selected options
  } else {
    val = form.elements[q.id].value;
  }

  data.responses[q.id] = val;
});


form.reset();
const msg = document.getElementById("saveMessage");
if (msg) {
  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), 2500);
} else {
  alert("Entry saved!"); // fallback if element not found
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



