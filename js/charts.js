// js/charts.js
import { loadQuestions, loadEntries, formatQuestionLabel, parseLocalDate } from "./storage.js";

function normalizeValue(val) {
  if (val === true || val === "true") return 10;
  if (val === false || val === "false") return 0;
  if (val === null || val === "") return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

export function initCompareChart({ getFilteredEntries, getQuestionsForView }) {
  const factorASelect = document.getElementById("factorA");
  const factorBSelect = document.getElementById("factorB");
  const optionsA = document.getElementById("optionsA");
  const optionsB = document.getElementById("optionsB");
  const compareBtn = document.getElementById("compareBtn");
  const clearChartBtn = document.getElementById("clearChartBtn");
  const compareCanvas = document.getElementById("compareChart");

  if (!factorASelect || !factorBSelect || !compareBtn || !compareCanvas) return;
  if (typeof Chart === "undefined") return;

  let currentChart = null;

  function renderOptionPicker(container, question) {
    if (!container) return;
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

  function populateFactorSelects() {
    // avoid duplicates
    if (factorASelect.options.length > 1 || factorBSelect.options.length > 1) return;

    const qs = getQuestionsForView();
    qs.forEach(q => {
      factorASelect.appendChild(new Option(formatQuestionLabel(q), q.id));
      factorBSelect.appendChild(new Option(formatQuestionLabel(q), q.id));
    });

    factorASelect.addEventListener("change", () => {
      const questions = loadQuestions();
      renderOptionPicker(optionsA, questions.find(q => q.id === factorASelect.value));
    });

    factorBSelect.addEventListener("change", () => {
      const questions = loadQuestions();
      renderOptionPicker(optionsB, questions.find(q => q.id === factorBSelect.value));
    });
  }

  populateFactorSelects();

  compareBtn.addEventListener("click", () => {
    const idA = factorASelect.value;
    const idB = factorBSelect.value;

    if (!idA || !idB || idA === idB) {
      alert("Please choose two different questions.");
      return;
    }

    const questions = loadQuestions();
    const qA = questions.find(q => q.id === idA);
    const qB = questions.find(q => q.id === idB);
    if (!qA || !qB) return alert("Could not find those questions.");

    const entries = getFilteredEntries();
    const labels = entries.map(e => e.date);
    const datasets = [];

    const selectedOptsA = optionsA ? Array.from(optionsA.querySelectorAll("input:checked")).map(c => c.value) : [];
    const selectedOptsB = optionsB ? Array.from(optionsB.querySelectorAll("input:checked")).map(c => c.value) : [];

    // A
    if (qA.type === "select" && qA.options) {
      qA.options.forEach(opt => {
        if (selectedOptsA.length && !selectedOptsA.includes(opt)) return;
        datasets.push({
          label: `${formatQuestionLabel(qA)}: ${opt}`,
          data: entries.map(e => Array.isArray(e.responses[idA]) ? (e.responses[idA].includes(opt) ? 1 : 0) : 0),
          borderWidth: 2,
          fill: false,
          yAxisID: "y2",
        });
      });
    } else {
      datasets.push({
        label: formatQuestionLabel(qA),
        data: entries.map(e => normalizeValue(e.responses[idA])),
        borderWidth: 2,
        fill: false,
      });
    }

    // B
    if (qB.type === "select" && qB.options) {
      qB.options.forEach(opt => {
        if (selectedOptsB.length && !selectedOptsB.includes(opt)) return;
        datasets.push({
          label: `${formatQuestionLabel(qB)}: ${opt}`,
          data: entries.map(e => Array.isArray(e.responses[idB]) ? (e.responses[idB].includes(opt) ? 1 : 0) : 0),
          borderWidth: 2,
          fill: false,
          yAxisID: "y2",
        });
      });
    } else {
      datasets.push({
        label: formatQuestionLabel(qB),
        data: entries.map(e => normalizeValue(e.responses[idB])),
        borderWidth: 2,
        fill: false,
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
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  });

  clearChartBtn?.addEventListener("click", () => {
    if (currentChart) currentChart.destroy();
    currentChart = null;
    if (optionsA) optionsA.innerHTML = "";
    if (optionsB) optionsB.innerHTML = "";
    factorASelect.value = "";
    factorBSelect.value = "";
  });
}
