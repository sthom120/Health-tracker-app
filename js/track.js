// js/track.js
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

  const saveBtn = document.getElementById("saveEntry");
  const goView = document.getElementById("goView");
  const dateField = document.getElementById("entryDate");
  const msg = document.getElementById("saveMessage");

  // Optional modal elements (only if you added them to track.html)
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

  let questions = loadQuestions();
  let entries = loadEntries();

  const params = new URLSearchParams(window.location.search);
  const isEditing = params.has("edit");
  const editEntryId = sessionStorage.getItem("editEntryId") || null;
  let entryToEdit = null;

  if (isEditing && editEntryId) {
    entryToEdit = entries.find(e => e.id === editEntryId) || null;
  }

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

        const s = normaliseScale(q.scale) || null;
        input.min = (s && Number.isFinite(s.min)) ? String(s.min) : "0";
        input.max = (s && Number.isFinite(s.max)) ? String(s.max) : "10";
        if (s && Number.isFinite(s.step)) input.step = String(s.step);
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

    if (q.type !== "select") input.name = q.id;
    return input;
  }

  function renderDailyForm() {
    const qs = activeQuestions();
    form.innerHTML = "";

    qs.forEach(q => {
      const card = document.createElement("div");
      card.classList.add("entry-card");

      const label = document.createElement("label");
      label.textContent = q.text + ": ";

      const input = buildInputForQuestion(q);
      label.appendChild(input);

      card.appendChild(label);
      form.appendChild(card);
    });

    setDefaultDate();

    // Prefill edit mode
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
            const box = form.querySelector(`input[name="${q.id}"][value="${CSS.escape(v)}"]`);
            if (box) box.checked = true;
          });
        } else {
          const el = form.elements[q.id];
          if (el && value !== undefined && value !== null) el.value = value;
        }
      });
    }
  }

  renderDailyForm();

  saveBtn?.addEventListener("click", () => {
    questions = loadQuestions();
    entries = loadEntries();

    const qs = questions.filter(q => !q.archived);
    const entryDate = (dateField && dateField.value) ? dateField.value : todayISODate();
    if (!entryDate) return alert("Please select a date.");

    const data = {
      date: entryDate,
      responses: {},
      meta: {},
      updatedAt: nowISO(),
    };

    qs.forEach(q => {
      let val;

      if (q.type === "boolean") {
        const raw = form.elements[q.id]?.value ?? "";
        if (raw === "true") val = true;
        else if (raw === "false") val = false;
        else val = null;
      } else if (q.type === "select") {
        val = Array.from(form.querySelectorAll(`input[name="${q.id}"]:checked`)).map(cb => cb.value);
      } else {
        val = form.elements[q.id]?.value ?? "";
      }

      data.responses[q.id] = val;
      data.meta[q.id] = { versionAtTime: q.version || 1 };
    });

    if (entryToEdit) {
      const idx = entries.findIndex(e => e.id === entryToEdit.id);
      if (idx !== -1) entries[idx] = { ...normaliseEntry(entries[idx]), ...data, id: entryToEdit.id };
      else entries.push(normaliseEntry({ ...data, id: createId("e") }));

      saveEntries(entries);
      sessionStorage.removeItem("editEntryId");
      window.location.href = "view.html";
      return;
    }

    // One entry per date overwrite prompt
    const existing = entries.find(e => e.date === entryDate);
    if (existing) {
      if (!confirm("An entry already exists for this date. Overwrite it?")) return;
      const idx = entries.findIndex(e => e.id === existing.id);
      entries[idx] = { ...normaliseEntry(existing), ...data, id: existing.id };
    } else {
      entries.push(normaliseEntry({ ...data, id: createId("e"), createdAt: nowISO() }));
    }

    saveEntries(entries);
    form.reset();
    if (dateField) dateField.value = todayISODate();
    renderDailyForm();

    if (msg) {
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2500);
    } else {
      alert("Entry saved!");
    }
  });

  goView?.addEventListener("click", () => (window.location.href = "view.html"));

  /* -------------------------------
     Optional question modal
     ------------------------------- */
  if (!questionModal || !modalForm) return;

  let modalEditingId = null;

  function modalSetTypeUI(type) {
    if (modalOptionsContainer) modalOptionsContainer.style.display = (type === "select") ? "block" : "none";
    if (modalScaleContainer) modalScaleContainer.style.display = (type === "number") ? "block" : "none";
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

        const s = normaliseScale(q.scale) || {};
        if (modalMin) modalMin.value = (s.min ?? "") === null ? "" : String(s.min ?? "");
        if (modalMax) modalMax.value = (s.max ?? "") === null ? "" : String(s.max ?? "");
        if (modalStep) modalStep.value = (s.step ?? "") === null ? "" : String(s.step ?? "");

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

      actions.appendChild(editBtn);
      actions.appendChild(archiveBtn);
      li.appendChild(actions);

      modalQuestionList.appendChild(li);
    });
  }

  modalType?.addEventListener("change", () => modalSetTypeUI(modalType.value));

  modalCancelEdit?.addEventListener("click", () => {
    modalEditingId = null;
    modalCancelEdit.classList.add("hidden");
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
    const options = (type === "select" && optsRaw)
      ? optsRaw.split(",").map(o => o.trim()).filter(Boolean)
      : [];

    const scale = (type === "number")
      ? normaliseScale({
          min: modalMin ? modalMin.value : null,
          max: modalMax ? modalMax.value : null,
          step: modalStep ? modalStep.value : null,
        })
      : null;

    if (modalEditingId) {
      const idx = questions.findIndex(q => q.id === modalEditingId);
      if (idx === -1) return;

      const oldQ = questions[idx];
      const updated = normaliseQuestion({
        ...oldQ,
        text,
        type,
        tags,
        options: (type === "select") ? options : (oldQ.options || []),
        scale: (type === "number") ? scale : null,
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

    questions.push(normaliseQuestion({
      text,
      type,
      tags,
      options: (type === "select") ? options : [],
      scale: (type === "number") ? scale : null,
      archived: false,
      version: 1,
    }));

    saveQuestions(questions);
    modalForm.reset();
    modalSetTypeUI(modalType?.value || "boolean");
    renderDailyForm();
    renderModalQuestionList();
  });

  addQuestionBtn?.addEventListener("click", openModal);
  manageQuestionsBtn?.addEventListener("click", openModal);
  closeQuestionModal?.addEventListener("click", closeModal);

  questionModal.addEventListener("click", e => {
    if (e.target === questionModal) closeModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !questionModal.classList.contains("hidden")) closeModal();
  });
}

initTrackPage();
