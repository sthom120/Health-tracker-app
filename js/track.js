// js/track.js
// ------------------------------------------------------------
// Track page logic (track.html)
//
// Responsibilities:
// - Render the daily form based on active questions
// - Save/update one entry per date
// - Support edit mode (from view page)
// - Optional: manage questions inside a modal while logging
// - Store an optional free-text comment per entry
// - NEW: support "time" questions (HH:MM)
// - NEW: show number question help + expandable descriptors (e.g. pain scale)
// ------------------------------------------------------------

import {
  loadQuestions,
  saveQuestions,
  loadEntries,
  saveEntries,
  normaliseEntry,
  normaliseQuestion,
  normaliseTags,
  normaliseScale,
  needsVersionBump,
  todayISODate,
  nowISO,
  createId,
} from "./storage.js";

function initTrackPage() {
  const form = document.getElementById("dailyForm");
  if (!form) return; // not on track page

  // ----------------------------
  // Main controls
  // ----------------------------
  const saveBtn = document.getElementById("saveEntry");
  const goView = document.getElementById("goView");
  const dateField = document.getElementById("entryDate");
  const msg = document.getElementById("saveMessage");

  // Optional entry-level comment (outside the modal)
  const commentEl = document.getElementById("entryComment");

  // ----------------------------
  // Optional question modal elements
  // ----------------------------
  const addQuestionBtn = document.getElementById("addQuestionBtn");
  const manageQuestionsBtn = document.getElementById("manageQuestionsBtn");
  const questionModal = document.getElementById("questionModal");
  const closeQuestionModal = document.getElementById("closeQuestionModal");

  const modalForm = document.getElementById("modalQuestionForm");
  const modalQuestionList = document.getElementById("modalQuestionList");
  const modalCancelEdit = document.getElementById("modalCancelEdit");

  const modalText = document.getElementById("modalQuestionText");
  const modalType = document.getElementById("modalQuestionType");
  const modalTags = document.getElementById("modalQuestionTags");

  const modalOptionsContainer = document.getElementById("modalOptionsContainer");
  const modalOptions = document.getElementById("modalQuestionOptions");

  const modalScaleContainer = document.getElementById("modalScaleContainer");
  const modalMin = document.getElementById("modalQuestionMin");
  const modalMax = document.getElementById("modalQuestionMax");
  const modalStep = document.getElementById("modalQuestionStep");

  // Optional newer modal fields (only exist if you added them in track.html)
  const modalPreset = document.getElementById("modalQuestionPreset");
  const modalUnits = document.getElementById("modalQuestionUnits");
  const modalDescriptors = document.getElementById("modalQuestionDescriptors");

  // ----------------------------
  // Load state
  // ----------------------------
  let questions = loadQuestions();
  let entries = loadEntries();

  // Edit mode (set by view.js)
  const params = new URLSearchParams(window.location.search);
  const isEditing = params.has("edit");
  const editEntryId = sessionStorage.getItem("editEntryId") || null;

  let entryToEdit = null;
  if (isEditing && editEntryId) {
    entryToEdit = entries.find(e => e.id === editEntryId) || null;
  }

  // ----------------------------
  // Helpers
  // ----------------------------
  function activeQuestions() {
    questions = loadQuestions();
    return questions.filter(q => !q.archived);
  }

  function setDefaultDate() {
    if (!dateField) return;

    if (entryToEdit) {
      dateField.value = entryToEdit.date;
      if (saveBtn) saveBtn.textContent = "Update Entry";
    } else if (!dateField.value) {
      dateField.value = todayISODate();
    }
  }

  // NOTE TO SELF:
  // This is where adding new answer types becomes easy.
  function buildInputForQuestion(q) {
    let input;

    switch (q.type) {
      case "boolean": {
        input = document.createElement("select");
        input.innerHTML = `
          <option value="">— Not answered —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        `;
        break;
      }

      case "number": {
        input = document.createElement("input");
        input.type = "number";

        // Use question-defined scale if present; otherwise let browser default.
        const s = normaliseScale(q.scale) || null;
        if (s && Number.isFinite(s.min)) input.min = String(s.min);
        if (s && Number.isFinite(s.max)) input.max = String(s.max);
        if (s && Number.isFinite(s.step)) input.step = String(s.step);

        break;
      }

      case "time": {
        input = document.createElement("input");
        input.type = "time"; // stores HH:MM
        break;
      }

      case "date": {
        input = document.createElement("input");
        input.type = "date";
        break;
      }

      case "select": {
        // Multi-select rendered as a checkbox group
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

    // For non-checkbox group inputs, set name so form.elements[q.id] works.
    if (q.type !== "select") input.name = q.id;
    return input;
  }

  function renderNumberHelpers(card, q) {
    // Small hint line (units + helpText)
    const bits = [];

    if (q.units) bits.push(`Units: ${q.units}`);
    if (q.helpText) bits.push(q.helpText);

    if (bits.length) {
      const hint = document.createElement("p");
      hint.className = "help-text";
      hint.textContent = bits.join(" • ");
      card.appendChild(hint);
    }

    // Optional expandable descriptor text (pain scale etc.)
    if (q.descriptorText && String(q.descriptorText).trim()) {
      const details = document.createElement("details");
      details.className = "help-text";

      const summary = document.createElement("summary");
      summary.textContent = "More info";
      details.appendChild(summary);

      const pre = document.createElement("pre");
      pre.style.whiteSpace = "pre-wrap";
      pre.style.marginTop = ".5rem";
      pre.textContent = q.descriptorText;
      details.appendChild(pre);

      card.appendChild(details);
    }
  }

  function renderDailyForm() {
    const qs = activeQuestions();
    form.innerHTML = "";

    // Render question cards
    qs.forEach(q => {
      const card = document.createElement("div");
      card.classList.add("entry-card");

      const label = document.createElement("label");
      label.textContent = q.text + ": ";

      const input = buildInputForQuestion(q);
      label.appendChild(input);

      card.appendChild(label);

      // Add number-specific help + scale descriptors (if provided)
      if (q.type === "number") {
        renderNumberHelpers(card, q);
      }

      form.appendChild(card);
    });

    setDefaultDate();

    // Prefill edit mode (responses)
    if (entryToEdit?.responses) {
      qs.forEach(q => {
        const value = entryToEdit.responses[q.id];

        if (q.type === "boolean") {
          const el = form.elements[q.id];
          if (!el) return;
          if (value === true) el.value = "true";
          else if (value === false) el.value = "false";
          else el.value = "";
        } else if (q.type === "select") {
          const selected = Array.isArray(value) ? value : [];
          selected.forEach(v => {
            const box = form.querySelector(
              `input[name="${q.id}"][value="${CSS.escape(v)}"]`
            );
            if (box) box.checked = true;
          });
        } else {
          const el = form.elements[q.id];
          if (el && value !== undefined && value !== null) el.value = value;
        }
      });
    }

    // Prefill comment in edit mode
    if (commentEl) {
      commentEl.value = entryToEdit?.comment || "";
    }
  }

  renderDailyForm();

  // ----------------------------------------------------------
  // Save entry (create new or update existing)
  // ----------------------------------------------------------
  saveBtn?.addEventListener("click", () => {
    questions = loadQuestions();
    entries = loadEntries();

    const qs = questions.filter(q => !q.archived);

    const entryDate = dateField?.value ? dateField.value : todayISODate();
    if (!entryDate) return alert("Please select a date.");

    const data = {
      date: entryDate,
      responses: {},
      meta: {},
      updatedAt: nowISO(),

      // Entry-level narrative context (clinician-friendly)
      comment: commentEl ? String(commentEl.value || "").trim() : "",
    };

    qs.forEach(q => {
      let val;

      if (q.type === "boolean") {
        const raw = form.elements[q.id]?.value ?? "";
        if (raw === "true") val = true;
        else if (raw === "false") val = false;
        else val = null;
      } else if (q.type === "select") {
        val = Array.from(
          form.querySelectorAll(`input[name="${q.id}"]:checked`)
        ).map(cb => cb.value);
      } else {
        // text / number / date / time
        val = form.elements[q.id]?.value ?? "";
      }

      data.responses[q.id] = val;

      // Store question version so the value’s meaning is preserved over time
      data.meta[q.id] = { versionAtTime: q.version || 1 };
    });

    // --- Edit existing entry flow ---
    if (entryToEdit) {
      const idx = entries.findIndex(e => e.id === entryToEdit.id);

      if (idx !== -1) {
        entries[idx] = {
          ...normaliseEntry(entries[idx]),
          ...data,
          id: entryToEdit.id,
        };
      } else {
        // If we can't find it, fallback to creating a new one
        entries.push(normaliseEntry({ ...data, id: createId("e") }));
      }

      saveEntries(entries);
      sessionStorage.removeItem("editEntryId");
      window.location.href = "view.html";
      return;
    }

    // --- One entry per date: overwrite prompt ---
    const existing = entries.find(e => e.date === entryDate);
    if (existing) {
      if (!confirm("An entry already exists for this date. Overwrite it?")) return;

      const idx = entries.findIndex(e => e.id === existing.id);
      entries[idx] = {
        ...normaliseEntry(existing),
        ...data,
        id: existing.id,
      };
    } else {
      entries.push(
        normaliseEntry({
          ...data,
          id: createId("e"),
          createdAt: nowISO(),
        })
      );
    }

    saveEntries(entries);

    // Reset UI after saving (not in edit mode)
    form.reset();
    if (dateField) dateField.value = todayISODate();
    if (commentEl) commentEl.value = "";
    renderDailyForm();

    if (msg) {
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2500);
    } else {
      alert("Entry saved!");
    }
  });

  goView?.addEventListener("click", () => (window.location.href = "view.html"));

  // ----------------------------------------------------------
  // Optional question modal
  // ----------------------------------------------------------
  if (!questionModal || !modalForm) return;

  let modalEditingId = null;

  function modalSetTypeUI(type) {
    if (modalOptionsContainer) {
      modalOptionsContainer.style.display = type === "select" ? "block" : "none";
    }
    if (modalScaleContainer) {
      modalScaleContainer.style.display = type === "number" ? "block" : "none";
    }
  }

  function openModal() {
    questionModal.classList.remove("hidden");
    modalEditingId = null;
    modalCancelEdit?.classList.add("hidden");
    modalForm.reset();
    modalSetTypeUI(modalType?.value || "boolean");
    renderModalQuestionList();
  }

  function closeModal() {
    questionModal.classList.add("hidden");
  }

  function renderModalQuestionList() {
    questions = loadQuestions();
    const active = questions.filter(q => !q.archived);

    if (!modalQuestionList) return;
    modalQuestionList.innerHTML = "";

    if (!active.length) {
      modalQuestionList.innerHTML = "<li><em>No active questions yet.</em></li>";
      return;
    }

    active.forEach(q => {
      const li = document.createElement("li");

      const left = document.createElement("span");
      left.textContent = `${q.text} (${q.type})`;
      li.appendChild(left);

      const actions = document.createElement("div");
      actions.classList.add("question-actions");

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.classList.add("small-edit-btn");

      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.textContent = "Archive";
      archiveBtn.classList.add("small-delete-btn");

      editBtn.addEventListener("click", () => {
        modalEditingId = q.id;
        modalCancelEdit?.classList.remove("hidden");

        if (modalText) modalText.value = q.text || "";
        if (modalType) modalType.value = q.type || "text";
        if (modalTags) modalTags.value = (q.tags || []).join(", ");
        if (modalOptions) modalOptions.value = Array.isArray(q.options) ? q.options.join(", ") : "";

        // Number fields
        const s = normaliseScale(q.scale) || {};
        if (modalMin) modalMin.value = s.min ?? "";
        if (modalMax) modalMax.value = s.max ?? "";
        if (modalStep) modalStep.value = s.step ?? "";

        // Optional newer fields
        if (modalPreset) modalPreset.value = q.preset || "";
        if (modalUnits) modalUnits.value = q.units || "";
        if (modalDescriptors) modalDescriptors.value = q.descriptorText || "";

        modalSetTypeUI(q.type);
      });

      archiveBtn.addEventListener("click", () => {
        if (!confirm("Archive this question? It will stop appearing in the daily form, but past data remains.")) return;
        const idx = questions.findIndex(x => x.id === q.id);
        if (idx === -1) return;

        questions[idx].archived = true;
        saveQuestions(questions);

        renderDailyForm();
        renderModalQuestionList();
      });

      actions.append(editBtn, archiveBtn);
      li.appendChild(actions);

      modalQuestionList.appendChild(li);
    });
  }

  modalType?.addEventListener("change", () => modalSetTypeUI(modalType.value));

  modalCancelEdit?.addEventListener("click", () => {
    modalEditingId = null;
    modalCancelEdit?.classList.add("hidden");
    modalForm.reset();
    modalSetTypeUI(modalType?.value || "boolean");
  });

  modalForm.addEventListener("submit", e => {
    e.preventDefault();
    questions = loadQuestions();

    const text = String(modalText?.value || "").trim();
    const type = modalType?.value || "text";
    if (!text) return;

    const tags = normaliseTags(modalTags?.value || "");

    const optsRaw = String(modalOptions?.value || "").trim();
    const options =
      type === "select" && optsRaw
        ? optsRaw.split(",").map(o => o.trim()).filter(Boolean)
        : [];

    const scale =
      type === "number"
        ? normaliseScale({
            min: modalMin?.value ?? null,
            max: modalMax?.value ?? null,
            step: modalStep?.value ?? null,
          })
        : null;

    // Optional newer fields
    const preset = type === "number" ? String(modalPreset?.value || "").trim() : "";
    const units = type === "number" ? String(modalUnits?.value || "").trim() : "";
    const descriptorText = type === "number" ? String(modalDescriptors?.value || "") : "";

    // Update existing question
    if (modalEditingId) {
      const idx = questions.findIndex(q => q.id === modalEditingId);
      if (idx === -1) return;

      const oldQ = questions[idx];

      const updated = normaliseQuestion({
        ...oldQ,
        text,
        type,
        tags,
        options: type === "select" ? options : (oldQ.options || []),
        scale: type === "number" ? scale : null,

        // New fields
        preset,
        units,
        descriptorText,
      });

      if (needsVersionBump(oldQ, updated)) {
        updated.version = (Number(oldQ.version) || 1) + 1;
      }

      questions[idx] = updated;
      saveQuestions(questions);

      modalEditingId = null;
      modalCancelEdit?.classList.add("hidden");
      modalForm.reset();
      modalSetTypeUI(modalType?.value || "boolean");

      renderDailyForm();
      renderModalQuestionList();
      return;
    }

    // Add new question
    questions.push(
      normaliseQuestion({
        text,
        type,
        tags,
        options: type === "select" ? options : [],
        scale: type === "number" ? scale : null,

        // New fields
        preset,
        units,
        descriptorText,

        archived: false,
        version: 1,
      })
    );

    saveQuestions(questions);
    modalForm.reset();
    modalSetTypeUI(modalType?.value || "boolean");
    renderDailyForm();
    renderModalQuestionList();
  });

  addQuestionBtn?.addEventListener("click", openModal);
  manageQuestionsBtn?.addEventListener("click", openModal);
  closeQuestionModal?.addEventListener("click", closeModal);

  // Click outside modal to close
  questionModal.addEventListener("click", e => {
    if (e.target === questionModal) closeModal();
  });

  // Escape key closes modal
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !questionModal.classList.contains("hidden")) closeModal();
  });
}

initTrackPage();
