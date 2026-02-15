// js/index.js
// ------------------------------------------------------------
// Setup page logic (index.html)
//
// Responsibilities:
// - Show time-of-day greeting theme
// - Add / edit / archive questions
// - Reorder active questions
// - “Danger zone” actions (clear questions/entries, full reset)
// - Navigation buttons (go to track page)
//
// NOTE TO SELF:
// This file assumes storage.js owns all localStorage formats.
// Keep all normalisation/version-bump logic inside storage.js.
// ------------------------------------------------------------

import {
  loadQuestions,
  saveQuestions,
  normaliseQuestion,
  normaliseTags,
  normaliseScale,
  needsVersionBump,
  resetAllData,
} from "./storage.js";

/* ------------------------------------------------------------
   Small utility: move an item in an array (for reorder buttons)
------------------------------------------------------------ */
function moveItem(arr, from, to) {
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
}

/* ------------------------------------------------------------
   Greeting + body theme class (purely UI polish)
   NOTE TO SELF:
   Add CSS classes like .theme-morning / .theme-afternoon / .theme-evening
   if you want background changes by time of day.
------------------------------------------------------------ */
function setGreetingTheme() {
  const greetingText = document.getElementById("greetingText");
  if (!greetingText) return;

  const hour = new Date().getHours();

  let greeting = "Hello";
  let subtext = "Welcome back.";
  let themeClass = "theme-day";

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

  greetingText.innerHTML = `<h1>${greeting}</h1><p id="greetingSub">${subtext}</p>`;

  // NOTE TO SELF: if you ever change themes, consider removing old theme classes first.
  document.body.classList.add(themeClass);
}

/* ------------------------------------------------------------
   Main entry: only run on index.html (guarded by #questionForm)
------------------------------------------------------------ */
function initSetupPage() {
  const form = document.getElementById("questionForm");
  if (!form) return; // not on index page

  setGreetingTheme();

  // --- Lists where we render questions ---
  const activeListEl = document.getElementById("questionList");
  const archivedListEl = document.getElementById("archivedQuestionList"); // optional

  // --- Navigation buttons ---
  const goTrackBtn = document.getElementById("goTrack");
  const quickTrackBtn = document.getElementById("quickTrackBtn");

  // --- Form fields ---
  const questionTextEl = document.getElementById("questionText");
  const questionTypeEl = document.getElementById("questionType");
  const tagsEl = document.getElementById("questionTags");

  const optionsContainerEl = document.getElementById("optionsContainer");
  const optionsEl = document.getElementById("questionOptions");

  const scaleContainerEl = document.getElementById("scaleContainer");
  const minEl = document.getElementById("questionMin");
  const maxEl = document.getElementById("questionMax");
  const stepEl = document.getElementById("questionStep");

  // --- Add/Edit mode controls ---
  const cancelEditBtn = document.getElementById("cancelEdit");
  const formTitleEl = document.getElementById("questionFormTitle");
  const submitBtn = document.getElementById("questionSubmit");

  // --- Danger zone buttons ---
  const deleteAllQuestionsBtn = document.getElementById("deleteAllQuestions");
  const deleteAllDataBtn = document.getElementById("deleteAllData");
  const resetAllBtn = document.getElementById("resetAllBtn");

  // --- In-memory state ---
  // NOTE TO SELF:
  // Keep `questions` as your working copy, but always reload before final save
  // if you suspect other pages could have changed storage.
  let questions = loadQuestions();
  let editingId = null;

  /* ----------------------------------------------------------
     UI helpers: show/hide fields based on selected answer type
  ---------------------------------------------------------- */
  function setTypeUI(type) {
    if (optionsContainerEl) {
      optionsContainerEl.style.display = type === "select" ? "block" : "none";
    }
    if (scaleContainerEl) {
      scaleContainerEl.style.display = type === "number" ? "block" : "none";
    }
  }

  questionTypeEl?.addEventListener("change", () => setTypeUI(questionTypeEl.value));

  /* ----------------------------------------------------------
     Reset form back to “Add” mode
  ---------------------------------------------------------- */
  function resetFormUI() {
    form.reset();
    editingId = null;

    setTypeUI(questionTypeEl?.value || "boolean");

    cancelEditBtn?.classList.add("hidden");
    if (formTitleEl) formTitleEl.textContent = "Add a Question";
    if (submitBtn) submitBtn.textContent = "Add to Tracker";
  }

  cancelEditBtn?.addEventListener("click", resetFormUI);

  /* ----------------------------------------------------------
     Archive/unarchive helpers
     NOTE TO SELF:
     We keep archived questions so historical data stays readable.
  ---------------------------------------------------------- */
  function archiveQuestion(id) {
    const q = questions.find(x => x.id === id);
    if (!q) return;

    if (!confirm("Archive this question? It will stop appearing in the daily form, but past data will be kept.")) {
      return;
    }

    q.archived = true;
    saveQuestions(questions);
    renderLists();
  }

  function unarchiveQuestion(id) {
    const q = questions.find(x => x.id === id);
    if (!q) return;

    q.archived = false;
    saveQuestions(questions);
    renderLists();
  }

  /* ----------------------------------------------------------
     Enter “Edit question” mode
     NOTE TO SELF:
     We preload values into the form, then submit updates the same question id.
  ---------------------------------------------------------- */
  function startEditQuestion(id) {
    const q = questions.find(x => x.id === id);
    if (!q) return;

    editingId = id;

    if (formTitleEl) formTitleEl.textContent = "Edit Question";
    if (submitBtn) submitBtn.textContent = "Save Changes";
    cancelEditBtn?.classList.remove("hidden");

    if (questionTextEl) questionTextEl.value = q.text || "";
    if (questionTypeEl) questionTypeEl.value = q.type || "text";
    if (tagsEl) tagsEl.value = (q.tags || []).join(", ");
    if (optionsEl) optionsEl.value = Array.isArray(q.options) ? q.options.join(", ") : "";

    const s = normaliseScale(q.scale) || {};
    if (minEl) minEl.value = s.min ?? "";
    if (maxEl) maxEl.value = s.max ?? "";
    if (stepEl) stepEl.value = s.step ?? "";

    setTypeUI(q.type);
  }

  /* ----------------------------------------------------------
     Render list of active questions (with reorder/edit/archive)
  ---------------------------------------------------------- */
  function renderActive(activeQuestions) {
    if (!activeListEl) return;

    activeListEl.innerHTML = "";

    if (!activeQuestions.length) {
      activeListEl.innerHTML = "<li><em>No questions added yet.</em></li>";
      return;
    }

    activeQuestions.forEach((q, index) => {
      const li = document.createElement("li");

      // Display label
      const info = document.createElement("span");

      const optionsText =
        q.type === "select" && Array.isArray(q.options) && q.options.length
          ? ` [${q.options.join(", ")}]`
          : "";

      const tagsText = q.tags?.length ? ` {${q.tags.join(", ")}}` : "";

      info.textContent = `${index + 1}. ${q.text} (${q.type})${optionsText}${tagsText}`;
      li.appendChild(info);

      // Action buttons container
      const actions = document.createElement("div");
      actions.classList.add("question-actions");

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.textContent = "↑";
      upBtn.classList.add("reorder-btn");

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.textContent = "↓";
      downBtn.classList.add("reorder-btn");

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.classList.add("small-edit-btn");

      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.textContent = "Archive";
      archiveBtn.classList.add("small-delete-btn");

      // Reorder handlers
      upBtn.addEventListener("click", () => {
        if (index === 0) return;

        // NOTE TO SELF:
        // We reorder within the *full* questions array but using active list indices.
        const activeIds = activeQuestions.map(aq => aq.id);
        const from = questions.findIndex(x => x.id === activeIds[index]);
        const to = questions.findIndex(x => x.id === activeIds[index - 1]);
        if (from < 0 || to < 0) return;

        moveItem(questions, from, to);
        saveQuestions(questions);
        renderLists();
      });

      downBtn.addEventListener("click", () => {
        if (index === activeQuestions.length - 1) return;

        const activeIds = activeQuestions.map(aq => aq.id);
        const from = questions.findIndex(x => x.id === activeIds[index]);
        const to = questions.findIndex(x => x.id === activeIds[index + 1]);
        if (from < 0 || to < 0) return;

        moveItem(questions, from, to);
        saveQuestions(questions);
        renderLists();
      });

      editBtn.addEventListener("click", () => startEditQuestion(q.id));
      archiveBtn.addEventListener("click", () => archiveQuestion(q.id));

      actions.append(upBtn, downBtn, editBtn, archiveBtn);
      li.appendChild(actions);

      activeListEl.appendChild(li);
    });
  }

  /* ----------------------------------------------------------
     Render list of archived questions (restore/edit)
  ---------------------------------------------------------- */
  function renderArchived(archivedQuestions) {
    if (!archivedListEl) return;

    archivedListEl.innerHTML = "";

    if (!archivedQuestions.length) {
      archivedListEl.innerHTML = "<li><em>No archived questions.</em></li>";
      return;
    }

    archivedQuestions.forEach(q => {
      const li = document.createElement("li");

      const info = document.createElement("span");

      const optionsText =
        q.type === "select" && Array.isArray(q.options) && q.options.length
          ? ` [${q.options.join(", ")}]`
          : "";

      const tagsText = q.tags?.length ? ` {${q.tags.join(", ")}}` : "";

      info.textContent = `${q.text} (${q.type})${optionsText}${tagsText}`;
      li.appendChild(info);

      const actions = document.createElement("div");
      actions.classList.add("question-actions");

      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.textContent = "Restore";
      restoreBtn.classList.add("small-edit-btn");

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.classList.add("small-edit-btn");

      restoreBtn.addEventListener("click", () => unarchiveQuestion(q.id));
      editBtn.addEventListener("click", () => startEditQuestion(q.id));

      actions.append(restoreBtn, editBtn);
      li.appendChild(actions);

      archivedListEl.appendChild(li);
    });
  }

  /* ----------------------------------------------------------
     Re-render lists (reload from storage to stay consistent)
  ---------------------------------------------------------- */
  function renderLists() {
    questions = loadQuestions();

    const active = questions.filter(q => !q.archived);
    const archived = questions.filter(q => q.archived);

    renderActive(active);
    renderArchived(archived);

    setTypeUI(questionTypeEl?.value || "boolean");
  }

  /* ----------------------------------------------------------
     Form submit = add OR edit a question
  ---------------------------------------------------------- */
  form.addEventListener("submit", e => {
    e.preventDefault();

    const text = String(questionTextEl?.value || "").trim();
    const type = questionTypeEl?.value || "text";
    if (!text) return;

    const tags = tagsEl ? normaliseTags(tagsEl.value) : [];

    // Parse options only when type === "select"
    const optsRaw = String(optionsEl?.value || "").trim();
    const options =
      type === "select" && optsRaw
        ? optsRaw.split(",").map(o => o.trim()).filter(Boolean)
        : [];

    // Parse scale only when type === "number"
    const scale =
      type === "number"
        ? normaliseScale({
            min: minEl?.value ?? null,
            max: maxEl?.value ?? null,
            step: stepEl?.value ?? null,
          })
        : null;

    // --- Edit existing question ---
    if (editingId) {
      const idx = questions.findIndex(q => q.id === editingId);
      if (idx === -1) {
        resetFormUI();
        return;
      }

      const oldQ = questions[idx];

      const updated = normaliseQuestion({
        ...oldQ,
        text,
        type,
        tags,
        // If switching away from "select", keep old options (so we don’t accidentally delete history configs)
        options: type === "select" ? options : (oldQ.options || []),
        scale: type === "number" ? scale : null,
      });

      // NOTE TO SELF:
      // If meaning changes, bump version so clinician can interpret history safely.
      if (needsVersionBump(oldQ, updated)) {
        updated.version = (Number(oldQ.version) || 1) + 1;
      }

      questions[idx] = updated;
      saveQuestions(questions);
      renderLists();
      resetFormUI();
      return;
    }

    // --- Add new question ---
    questions.push(
      normaliseQuestion({
        text,
        type,
        tags,
        options: type === "select" ? options : [],
        scale: type === "number" ? scale : null,
        archived: false,
        version: 1,
      })
    );

    saveQuestions(questions);
    renderLists();
    resetFormUI();
  });

  /* ----------------------------------------------------------
     Danger zone actions
  ---------------------------------------------------------- */

  // Clear questions + entries (keeps PIN unless your resetAllData removes it)
  deleteAllQuestionsBtn?.addEventListener("click", () => {
    if (!confirm("Delete ALL questions and ALL entries?")) return;

    localStorage.removeItem("questions");
    localStorage.removeItem("entries");

    questions = [];
    renderLists();
    alert("All questions and data cleared.");
  });

  // Clear entries only
  deleteAllDataBtn?.addEventListener("click", () => {
    if (!confirm("Delete ALL recorded entries (keep questions)?")) return;

    localStorage.removeItem("entries");
    alert("All recorded data cleared.");
  });

  // Full reset (uses your storage.js helper so logic lives in one place)
  resetAllBtn?.addEventListener("click", () => {
    resetAllData();
    window.location.reload();
  });

  /* ----------------------------------------------------------
     Navigation: go to tracking page
  ---------------------------------------------------------- */
  goTrackBtn?.addEventListener("click", () => (window.location.href = "track.html"));
  quickTrackBtn?.addEventListener("click", () => (window.location.href = "track.html"));

  // Initial render
  renderLists();
}

initSetupPage();
