/* ============================================================
   CUSTOM TRACKER – main.js
   ============================================================
   Controls:
   1. index.html → Setup questions & data management
   2. track.html → Enter daily data
   3. view.html  → View & analyse data
   4. PIN triggers → Open change/remove PIN screens
   ============================================================ */


/* ============================================================
   1️⃣  SETUP PAGE — Create / Delete Questions
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

  /* ---------- Greeting + Theme ---------- */
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

  // ---------- Load saved questions ----------
  let questions = JSON.parse(localStorage.getItem("questions") || "[]");

  // ---------- Render Question List ----------
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

      // Delete button
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
    if (!confirm("Delete this question and remove its data?")) return;

    questions = questions.filter(q => q.id !== id);
    localStorage.setItem("questions", JSON.stringify(questions));

    const entries = JSON.parse(localStorage.getItem("entries") || "[]");
    entries.forEach(e => delete e.responses[id]);
    localStorage.setItem("entries", JSON.stringify(entries));

    renderList();
  }

  // ---------- Show/hide options for "select" ----------
  questionType.addEventListener("change", () => {
    optionsContainer.style.display =
      questionType.value === "select" ? "block" : "none";
  });

  // ---------- Add Question ----------
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
    if (!confirm("Delete ALL questions and ALL saved entries?")) return;
    localStorage.removeItem("questions");
    localStorage.removeItem("entries");
    questions = [];
    renderList();
  });

  // ---------- Delete ONLY entries ----------
  deleteAllData.addEventListener("click", () => {
    if (!confirm("Delete all recorded entries?")) return;
    localStorage.removeItem("entries");
  });

  renderList();

  // ---------- Start Logging ----------
  goTrack.addEventListener("click", () => window.location.href = "track.html");
}

// Quick Track Button
document.getElementById("quickTrackBtn")?.addEventListener("click", () => {
  window.location.href = "track.html";
});


/* ============================================================
   2️⃣  TRACK PAGE — Record Daily Data
   ============================================================ */
if (document.getElementById("dailyForm")) {

  const questions = JSON.parse(localStorage.getItem("questions") || "[]");
  const form = document.getElementById("dailyForm");
  const saveBtn = document.getElementById("saveEntry");
  const goView = document.getElementById("goView");

  // Build form inputs dynamically
  questions.forEach(q => {
    const card = document.createElement("div");
    card.classList.add("entry-card");

    const label = document.createElement("label");
    label.textContent = q.text + ": ";

    let input;

    switch (q.type) {
      case "boolean":
        input = document.createElement("select");
        input.innerHTML = `<option value="true">Yes</option><option value="false">No</option>`;
        break;

      case "number":
        input = document.createElement("input");
        input.type = "number";
        input.min = 0;
        input.max = 10;
        break;

      case "date":
        input = document.createElement("input");
        input.type = "date";
        break;

      case "select":
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

      default:
        input = document.createElement("input");
        input.type = "text";
    }

    if (q.type !== "select") input.name = q.id;

    label.appendChild(input);
    card.appendChild(label);
    form.appendChild(card);
  });

  // ---------- Save Entry ----------
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
        val = Array.from(
          form.querySelectorAll(`input[name="${q.id}"]:checked`)
        ).map(cb => cb.value);
      } else {
        val = form.elements[q.id].value;
      }

      data.responses[q.id] = val;
    });

    localStorage.setItem("entries", JSON.stringify([...entries, data]));
    form.reset();

    const msg = document.getElementById("saveMessage");
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2500);
  });

  goView.addEventListener("click", () => window.location.href = "view.html");
}


/* ============================================================
   3️⃣  VIEW PAGE — Display + Analyse Data
   ============================================================ */
if (document.getElementById("dataTable")) {

  const table = document.getElementById("dataTable");
  const questions = JSON.parse(localStorage.getItem("questions") || "[]");
  const entries = JSON.parse(localStorage.getItem("entries") || "[]");
  const timeframeSelect = document.getElementById("timeframeSelect");

  // Filtering helpers
  function filterEntries(days) {
    if (days === "all") return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));
    return entries.filter(e => new Date(e.date) >= cutoff);
  }

  function getEntries() {
    const days = timeframeSelect.value || "all";
    return filterEntries(days).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  timeframeSelect?.addEventListener("change", renderTable);

  // ---------- Render Table ----------
  function renderTable() {
    table.innerHTML = "";

    const header = document.createElement("tr");
    header.innerHTML =
      "<th>Date</th>" +
      questions.map(q => `<th>${q.text}</th>`).join("") +
      "<th>Actions</th>";

    table.appendChild(header);

    const filtered = getEntries();

    filtered.forEach((e, idx) => {
      const row = document.createElement("tr");
      let html = `<td>${e.date}</td>`;

      questions.forEach(q => {
        const val = e.responses[q.id];
        html += `<td>${Array.isArray(val) ? val.join(", ") : (val ?? "")}</td>`;
      });

      html += `<td><button class="danger small-delete" data-index="${idx}">Delete</button></td>`;
      row.innerHTML = html;
      table.appendChild(row);
    });

    // Delete buttons
    table.querySelectorAll(".small-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!confirm("Delete this entry?")) return;

        const idx = btn.dataset.index;
        const filtered = getEntries();
        const target = filtered[idx];

        const updated = entries.filter(e =>
          !(e.date === target.date &&
            JSON.stringify(e.responses) === JSON.stringify(target.responses))
        );

        localStorage.setItem("entries", JSON.stringify(updated));
        renderTable();
      });
    });
  }

  renderTable();

  /* ---------- CHARTING LOGIC ---------- */

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
    if (question?.type === "select" && question.options) {
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
      factorASelect.append(new Option(q.text, q.id));
      factorBSelect.append(new Option(q.text, q.id));
    });

    factorASelect.addEventListener("change", () =>
      renderOptionPicker(optionsA, questions.find(q => q.id == factorASelect.value))
    );

    factorBSelect.addEventListener("change", () =>
      renderOptionPicker(optionsB, questions.find(q => q.id == factorBSelect.value))
    );

    function normalize(val) {
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

      const filtered = getEntries();
      const labels = filtered.map(e => e.date);

      const qA = questions.find(q => q.id == idA);
      const qB = questions.find(q => q.id == idB);

      const datasets = [];

      const optsA = Array.from(optionsA.querySelectorAll("input:checked")).map(c => c.value);
      const optsB = Array.from(optionsB.querySelectorAll("input:checked")).map(c => c.value);

      // Dataset A
      if (qA.type === "select") {
        qA.options.forEach((opt, idx) => {
          if (!optsA.includes(opt)) return;
          const data = filtered.map(e => (e.responses[idA] === opt ? 1 : 0));
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
        datasets.push({
          label: qA.text,
          data: filtered.map(e => normalize(e.responses[idA])),
          borderColor: "rgba(255,99,132,1)",
          borderWidth: 2,
          fill: false
        });
      }

      // Dataset B
      if (qB.type === "select") {
        qB.options.forEach((opt, idx) => {
          if (!optsB.includes(opt)) return;
          const data = filtered.map(e => (e.responses[idB] === opt ? 1 : 0));
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
        datasets.push({
          label: qB.text,
          data: filtered.map(e => normalize(e.responses[idB])),
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

    clearChartBtn.addEventListener("click", () => {
      if (currentChart) currentChart.destroy();
      currentChart = null;

      optionsA.innerHTML = "";
      optionsB.innerHTML = "";
      factorASelect.value = "";
      factorBSelect.value = "";
    });
  }


  /* ---------- Export buttons ---------- */
  document.getElementById("exportJSON")?.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem("entries") || "[]");
    if (!data.length) return alert("No entries to export.");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "tracker-data.json" });
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("exportCSV")?.addEventListener("click", () => {
    const entries = JSON.parse(localStorage.getItem("entries") || "[]");
    if (!entries.length) return alert("No entries to export.");

    const headers = ["Date", ...questions.map(q => q.text)];
    const rows = entries.map(entry => [
      entry.date,
      ...questions.map(q => entry.responses[q.id] ?? "")
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "tracker-data.csv" });
    a.click();
    URL.revokeObjectURL(url);
  });
}


/* ============================================================
   🔐 PIN SETTINGS — OPEN PIN MANAGEMENT SCREEN
   (Actual PIN logic lives in pin-lock.js)
   ============================================================ */

document.getElementById("changePinBtn")?.addEventListener("click", () => {
  window.location.href = "pin-lock.html?mode=change";
});

document.getElementById("removePinBtn")?.addEventListener("click", () => {
  window.location.href = "pin-lock.html?mode=remove";
});
