document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("converter-form");
  const converterGrid = document.querySelector(".grid");
  const conversionTypeInput = document.getElementById("conversion-type");
  const fileInput = document.getElementById("file-input");

  const tabs = {
    bib2ris: document.getElementById("tab-bib2ris"),
    ris2bib: document.getElementById("tab-ris2bib"),
    doi2bib: document.getElementById("tab-doi2bib"),
    isbn2bib: document.getElementById("tab-isbn2bib"),
  };

  const inputTitle = document.getElementById("input-title");
  const outputTitle = document.getElementById("output-title");
  const inputText = document.getElementById("input-text");
  const outputText = document.getElementById("output-text");
  const downloadBtnText = document.getElementById("download-btn-text");
  const uploadBtn = document.getElementById("upload-btn");
  const clearBtn = document.getElementById("clear-btn");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const convertBtn = document.getElementById("convert-btn");
  const notificationArea = document.getElementById("notification-area");
  const duplicateWarning = document.getElementById("duplicate-warning");

  const bibtexWorkspace = document.getElementById("bibtex-workspace");
  const generatedEntries = document.getElementById("generated-entries");
  const saveAllBibtexBtn = document.getElementById("save-all-bibtex");
  const repositoryEntries = document.getElementById("repository-entries");
  const repositoryCount = document.getElementById("repository-count");
  const repositoryPageSize = document.getElementById("repository-page-size");
  const repositoryPagination = document.getElementById("repository-pagination");
  const exportRepositoryBtn = document.getElementById("export-repository");
  const clearRepositoryBtn = document.getElementById("clear-repository");

  const managerBtn = document.getElementById("manager-btn");
  const managerModal = document.getElementById("manager-modal");
  const closeManager = document.getElementById("close-manager");
  const tidyRun = document.getElementById("tidy-run");
  const tidyApply = document.getElementById("tidy-apply");
  const tidyCopyRepository = document.getElementById("tidy-copy-repository");
  const tidyWarnings = document.getElementById("tidy-warnings");
  const tidyPreview = document.getElementById("tidy-preview");

  const manualBibtexBtn = document.getElementById("manual-bibtex-btn");
  const manualBibtexModal = document.getElementById("manual-bibtex-modal");
  const closeManualBibtex = document.getElementById("close-manual-bibtex");
  const manualBibtexInput = document.getElementById("manual-bibtex-input");
  const manualBibtexClear = document.getElementById("manual-bibtex-clear");
  const manualBibtexSave = document.getElementById("manual-bibtex-save");
  const aiBibtexSource = document.getElementById("ai-bibtex-source");
  const aiBibtexGenerate = document.getElementById("ai-bibtex-generate");

  const entryModal = document.getElementById("entry-modal");
  const entryModalTitle = document.getElementById("entry-modal-title");
  const closeEntryModal = document.getElementById("close-entry-modal");
  const entryKeyLabel = document.getElementById("entry-key-label");
  const entryKeyInput = document.getElementById("entry-key-input");
  const entryTextarea = document.getElementById("entry-textarea");
  const entryCopy = document.getElementById("entry-copy");
  const entrySave = document.getElementById("entry-save");

  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettings = document.getElementById("close-settings");
  const saveSettingsBtn = document.getElementById("save-settings");
  const resetSettingsBtn = document.getElementById("reset-settings");
  const autoCopyToggle = document.getElementById("auto-copy-toggle");
  const editModeToggle = document.getElementById("edit-mode-toggle");

  const SETTINGS_KEY = "bibConverterSettings";
  const BIBTEX_REPOSITORY_KEY = "bibtexRepository";
  const GRID_HEIGHT_KEY = "converterGridHeight";
  const defaultSettings = { autoCopy: false, editMode: false };
  const endpointByMode = {
    bib2ris: "/api/bibtex-to-ris",
    ris2bib: "/api/ris-to-bibtex",
    doi2bib: "/api/doi-to-bibtex",
    isbn2bib: "/api/isbn-to-bibtex",
  };

  let settings = getSettings();
  let currentGeneratedEntries = [];
  let repositoryState = { page: 1, pageSize: 10 };
  let entryModalMode = "view";
  let activeEntryKey = "";
  let tidyResult = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
    } catch (_e) {
      return { ...defaultSettings };
    }
  }

  function saveSettings(settingsValue) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsValue));
  }

  function getRepository() {
    try {
      const raw = localStorage.getItem(BIBTEX_REPOSITORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  }

  function saveRepository(entries) {
    localStorage.setItem(BIBTEX_REPOSITORY_KEY, JSON.stringify(entries));
  }

  function applySettings() {
    autoCopyToggle.checked = !!settings.autoCopy;
    editModeToggle.checked = !!settings.editMode;
    outputText.readOnly = !settings.editMode;
  }

  function showNotification(message, type = "success", details = []) {
    const cls = type === "error" ? "error" : type === "warning" ? "warning" : "success";
    const detailHtml = details.length
      ? `<ul>${details.slice(0, 6).map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
      : "";
    const toast = document.createElement("div");
    toast.className = `alert ${cls}`;
    toast.innerHTML = `${escapeHtml(message)}${detailHtml}`;
    notificationArea.appendChild(toast);
    window.setTimeout(() => toast.remove(), cls === "error" ? 7000 : 4200);
  }

  function applySavedGridHeight() {
    if (!converterGrid) return;
    const savedHeight = Number(localStorage.getItem(GRID_HEIGHT_KEY));
    if (Number.isFinite(savedHeight) && savedHeight >= 360) {
      converterGrid.style.height = `${savedHeight}px`;
    }
  }

  function watchGridHeight() {
    if (!converterGrid || typeof ResizeObserver === "undefined") return;
    let previousHeight = Math.round(converterGrid.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = Math.round(entry.contentRect.height);
      if (!Number.isFinite(nextHeight) || Math.abs(nextHeight - previousHeight) < 4) return;
      previousHeight = nextHeight;
      localStorage.setItem(GRID_HEIGHT_KEY, String(nextHeight));
    });
    observer.observe(converterGrid);
  }

  function normalizeKeyForCompare(key) {
    return String(key || "").trim().toLowerCase();
  }

  function collectUsedKeys(extraEntries = []) {
    const keys = new Set();
    getRepository().forEach((entry) => keys.add(normalizeKeyForCompare(entry.key)));
    extraEntries.forEach((entry) => keys.add(normalizeKeyForCompare(entry.key)));
    keys.delete("");
    return keys;
  }

  function createHexKey(usedKeys) {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const bytes = new Uint8Array(3);
      if (window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        bytes.forEach((_value, index) => {
          bytes[index] = Math.floor(Math.random() * 256);
        });
      }
      const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const normalized = normalizeKeyForCompare(key);
      if (!usedKeys.has(normalized)) {
        usedKeys.add(normalized);
        return key;
      }
    }

    const fallback = Date.now().toString(16).slice(-6);
    usedKeys.add(normalizeKeyForCompare(fallback));
    return fallback;
  }

  function normalizeDoi(value) {
    let normalized = (value || "").trim();
    if (!normalized) return "";
    normalized = stripRequestedKey(normalized);
    normalized = normalized.replace(/^doi\s*:\s*/i, "").replace(/^<+|>+$/g, "");
    const match = normalized.match(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\/(.+)$/i);
    if (match) normalized = match[1].trim();
    normalized = normalized.replace(/[.;,]+$/g, "");
    return /^10\.\d{4,9}\/\S+$/i.test(normalized) ? normalized.toLowerCase() : "";
  }

  function normalizeIsbn(value) {
    let normalized = (value || "").trim();
    if (!normalized) return "";
    normalized = stripRequestedKey(normalized);
    normalized = normalized.replace(/^isbn\s*:?\s*/i, "");
    normalized = normalized.replace(/[^\dXx \-]/g, "");
    const compact = normalized.replace(/[ -]/g, "").toUpperCase();
    return /^\d{13}$/.test(compact) || /^\d{9}[\dX]$/.test(compact) ? compact : "";
  }

  function stripRequestedKey(value) {
    const match = String(value || "").trim().match(/^\{[^{}]+\}\s*(.+)$/);
    return match ? match[1].trim() : String(value || "").trim();
  }

  function updateDuplicateWarning() {
    const mode = conversionTypeInput.value;
    if (mode !== "doi2bib" && mode !== "isbn2bib") {
      duplicateWarning.classList.add("hidden");
      duplicateWarning.innerHTML = "";
      return;
    }

    const normalizer = mode === "isbn2bib" ? normalizeIsbn : normalizeDoi;
    const label = mode === "isbn2bib" ? "ISBN" : "DOI";
    const seen = new Map();
    const duplicates = [];

    inputText.value.split(/\r?\n/).forEach((line, index) => {
      const normalized = normalizer(line);
      if (!normalized) return;
      if (seen.has(normalized)) {
        duplicates.push(`Dòng ${index + 1} trùng với dòng ${seen.get(normalized)}: ${label} ${normalized}`);
      } else {
        seen.set(normalized, index + 1);
      }
    });

    if (!duplicates.length) {
      duplicateWarning.classList.add("hidden");
      duplicateWarning.innerHTML = "";
      return;
    }

    duplicateWarning.innerHTML = `<strong>Phát hiện ${label} trùng lặp.</strong><br>${duplicates
      .slice(0, 5)
      .map((item) => escapeHtml(item))
      .join("<br>")}`;
    duplicateWarning.classList.remove("hidden");
  }

  function parseBibtexEntries(bibtexText, options = {}) {
    const entries = [];
    const usedKeys = collectUsedKeys(currentGeneratedEntries);
    const requestedKeys = Array.isArray(options.requestedKeys) ? options.requestedKeys : [];
    const preserveExistingKeys = !!options.preserveExistingKeys;
    let current = "";
    let braceDepth = 0;
    let started = false;

    String(bibtexText || "")
      .split(/\r?\n/)
      .forEach((line) => {
        if (!started && !line.trim().startsWith("@")) return;
        if (!started) {
          current = "";
          braceDepth = 0;
          started = true;
        }

        current += `${line}\n`;
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        if (started && braceDepth <= 0 && current.trim()) {
          const entry = current.trim();
          const requestedKey = String(requestedKeys[entries.length] || "").trim();
          const existingKey = preserveExistingKeys ? extractBibtexKey(entry) : "";
          const key = requestedKey || existingKey || createHexKey(usedKeys);
          usedKeys.add(normalizeKeyForCompare(key));
          entries.push({
            id: `${Date.now()}-${entries.length}-${Math.random().toString(36).slice(2)}`,
            key,
            entry: replaceBibtexKey(entry, key),
          });
          current = "";
          started = false;
        }
      });

    return entries;
  }

  function extractBibtexKey(entryText) {
    const match = String(entryText || "").match(/^@[^{\s]+\s*{\s*([^,\s]+)\s*,/);
    return match ? match[1].trim() : "";
  }

  function replaceBibtexKey(entryText, nextKey) {
    return String(entryText || "").replace(/^(@[^{\s]+\s*{\s*)([^,\s]+)(\s*,)/, (_match, prefix, _oldKey, suffix) => {
      return `${prefix}${nextKey}${suffix}`;
    });
  }

  function syncOutputFromGeneratedEntries() {
    outputText.value = currentGeneratedEntries.length
      ? `${currentGeneratedEntries.map((item) => item.entry).join("\n\n")}\n`
      : "";
  }

  function isBibtexMode() {
    return conversionTypeInput.value !== "bib2ris";
  }

  function renderGeneratedEntries() {
    if (!isBibtexMode()) {
      bibtexWorkspace.classList.add("hidden");
      generatedEntries.innerHTML = "";
      saveAllBibtexBtn.disabled = true;
      renderRepository();
      return;
    }

    bibtexWorkspace.classList.remove("hidden");
    saveAllBibtexBtn.disabled = !currentGeneratedEntries.length;
    if (!currentGeneratedEntries.length) {
      generatedEntries.innerHTML = '<p class="empty-state">Các mục BibTeX đã tạo sẽ hiển thị tại đây.</p>';
      renderRepository();
      return;
    }

    generatedEntries.innerHTML = currentGeneratedEntries
      .map(
        (item, index) => `
          <div class="bibtex-entry-card" data-entry-id="${escapeHtml(item.id)}">
            <div class="bibtex-entry-meta">
              <label>
                Khoá trích dẫn
                <input class="bibtex-key-input" type="text" value="${escapeHtml(item.key)}" data-index="${index}">
              </label>
              <button type="button" class="btn-outline save-bibtex-entry" data-index="${index}">Lưu</button>
            </div>
            <pre>${escapeHtml(item.entry)}</pre>
          </div>
        `
      )
      .join("");
    renderRepository();
  }

  function saveBibtexEntries(entries) {
    const repository = getRepository();
    const now = new Date().toISOString();
    const existingKeys = collectUsedKeys();
    const batchKeys = new Set();
    const savedEntries = [];
    const skippedEntries = [];

    entries.forEach((entry) => {
      const key = entry.key.trim();
      const normalizedKey = normalizeKeyForCompare(key);
      if (!key) {
        skippedEntries.push({ entry, reason: "Thiếu khoá trích dẫn." });
        return;
      }
      if (existingKeys.has(normalizedKey) || batchKeys.has(normalizedKey)) {
        skippedEntries.push({ entry, reason: `Khoá "${key}" đã tồn tại.` });
        return;
      }
      batchKeys.add(normalizedKey);

      const normalizedEntry = {
        id: key,
        key,
        entry: replaceBibtexKey(entry.entry, key),
        sourceMode: entry.sourceMode || conversionTypeInput.value,
        updatedAt: now,
      };
      repository.unshift({ ...normalizedEntry, createdAt: now });
      savedEntries.push(entry);
    });

    if (savedEntries.length) {
      saveRepository(repository);
      renderRepository();
    }

    return { savedEntries, skippedEntries };
  }

  function saveGeneratedEntry(index) {
    const entry = currentGeneratedEntries[index];
    if (!entry || !entry.key.trim()) return;

    const result = saveBibtexEntries([entry]);
    if (!result.savedEntries.length) {
      showNotification(result.skippedEntries[0]?.reason || "Không thể lưu mục BibTeX.", "warning");
      return;
    }

    currentGeneratedEntries.splice(index, 1);
    syncOutputFromGeneratedEntries();
    renderGeneratedEntries();
    showNotification(`Đã lưu mục BibTeX "${entry.key}".`, "success");
  }

  function renderRepository() {
    const repository = getRepository();
    const total = repository.length;
    const pageSize = Number(repositoryPageSize.value || repositoryState.pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    repositoryState.pageSize = pageSize;
    repositoryState.page = Math.min(Math.max(1, repositoryState.page), totalPages);
    repositoryCount.textContent = `${total} mục đã lưu`;

    if (!total) {
      repositoryEntries.innerHTML = '<p class="empty-state">Chưa có BibTeX nào được lưu.</p>';
      repositoryPagination.innerHTML = "";
      exportRepositoryBtn.disabled = true;
      clearRepositoryBtn.disabled = true;
      return;
    }

    exportRepositoryBtn.disabled = false;
    clearRepositoryBtn.disabled = false;
    const start = (repositoryState.page - 1) * pageSize;
    const visibleEntries = repository.slice(start, start + pageSize);

    repositoryEntries.innerHTML = visibleEntries
      .map(
        (item) => `
          <div class="repository-entry" data-key="${escapeHtml(item.key)}">
            <div>
              <strong>${escapeHtml(item.key)}</strong>
              <small>${escapeHtml(item.sourceMode || "bibtex")} · ${escapeHtml(
                new Date(item.updatedAt || item.createdAt).toLocaleString()
              )}</small>
            </div>
            <div class="repository-actions">
              <button type="button" class="btn-outline copy-repository-entry" data-key="${escapeHtml(item.key)}">Sao chép</button>
              <button type="button" class="btn-outline view-repository-entry" data-key="${escapeHtml(item.key)}">Xem</button>
              <button type="button" class="btn-outline edit-repository-entry" data-key="${escapeHtml(item.key)}">Sửa</button>
              <button type="button" class="btn-link delete-repository-entry" data-key="${escapeHtml(item.key)}">Xoá</button>
            </div>
          </div>
        `
      )
      .join("");

    repositoryPagination.innerHTML = `
      <button type="button" class="btn-outline repository-page-prev" ${repositoryState.page <= 1 ? "disabled" : ""}>Trước</button>
      <span>Trang ${repositoryState.page} / ${totalPages}</span>
      <button type="button" class="btn-outline repository-page-next" ${repositoryState.page >= totalPages ? "disabled" : ""}>Sau</button>
    `;
  }

  function getRepositoryBibtex() {
    return getRepository()
      .map((item) => item.entry)
      .join("\n\n")
      .trim();
  }

  function setActiveTab(mode) {
    Object.values(tabs).forEach((tab) => tab.classList.remove("active"));
    tabs[mode].classList.add("active");
  }

  function setMode(mode) {
    currentGeneratedEntries = [];
    conversionTypeInput.value = mode;
    setActiveTab(mode);

    if (mode === "bib2ris") {
      inputTitle.textContent = "Đầu vào: BibTeX";
      outputTitle.textContent = "Đầu ra: RIS";
      inputText.placeholder = "Dán trích dẫn BibTeX tại đây...";
      downloadBtnText.textContent = "Tải xuống .ris";
    } else if (mode === "ris2bib") {
      inputTitle.textContent = "Đầu vào: RIS";
      outputTitle.textContent = "Đầu ra: BibTeX";
      inputText.placeholder = "Dán trích dẫn RIS tại đây...";
      downloadBtnText.textContent = "Tải xuống .bib";
    } else if (mode === "doi2bib") {
      inputTitle.textContent = "Đầu vào: DOI (mỗi dòng một DOI)";
      outputTitle.textContent = "Đầu ra: BibTeX";
      inputText.placeholder = "Mỗi dòng một DOI. Có thể dùng {key}10.x/... để đặt khoá BibTeX.";
      downloadBtnText.textContent = "Tải xuống .bib";
    } else {
      inputTitle.textContent = "Đầu vào: ISBN (mỗi dòng một ISBN)";
      outputTitle.textContent = "Đầu ra: BibTeX";
      inputText.placeholder = "Mỗi dòng một ISBN. Có thể dùng {key}978-0-446-31078-9 để đặt khoá BibTeX.";
      downloadBtnText.textContent = "Tải xuống .bib";
    }

    updateDuplicateWarning();
    renderGeneratedEntries();
  }

  function openEntryModal(mode, key) {
    const item = getRepository().find((entry) => entry.key === key);
    if (!item) return;

    entryModalMode = mode;
    activeEntryKey = key;
    entryModalTitle.textContent = mode === "edit" ? `Sửa ${key}` : `Xem ${key}`;
    entryKeyInput.value = item.key;
    entryTextarea.value = item.entry;
    entryTextarea.readOnly = mode !== "edit";
    entryKeyLabel.classList.toggle("hidden", mode !== "edit");
    entrySave.classList.toggle("hidden", mode !== "edit");
    entryModal.classList.remove("hidden");
  }

  function closeEntry() {
    entryModal.classList.add("hidden");
    activeEntryKey = "";
  }

  function buildTidyOptions() {
    const duplicateSelect = document.getElementById("tidy-duplicates");
    const selectedDuplicates = Array.from(duplicateSelect.selectedOptions).map((option) => option.value);
    const merge = document.getElementById("tidy-merge").value;
    const align = Number(document.getElementById("tidy-align").value);
    const wrap = Number(document.getElementById("tidy-wrap").value);

    return {
      duplicates: selectedDuplicates.length ? selectedDuplicates : true,
      merge: merge || false,
      align: align > 0 ? align : false,
      wrap: wrap > 0 ? wrap : false,
      curly: document.getElementById("tidy-curly").checked,
      sort: document.getElementById("tidy-sort").checked,
      sortFields: document.getElementById("tidy-sort-fields").checked,
      blankLines: document.getElementById("tidy-blank-lines").checked,
      removeEmptyFields: document.getElementById("tidy-remove-empty").checked,
      removeDuplicateFields: document.getElementById("tidy-remove-dupe-fields").checked,
      stripComments: document.getElementById("tidy-strip-comments").checked,
      trailingCommas: document.getElementById("tidy-trailing-commas").checked,
      stripEnclosingBraces: document.getElementById("tidy-strip-enclosing").checked,
      dropAllCaps: document.getElementById("tidy-drop-caps").checked,
      encodeUrls: document.getElementById("tidy-encode-urls").checked,
    };
  }

  function renderTidyWarnings(warnings) {
    if (!warnings || !warnings.length) {
      tidyWarnings.innerHTML = '<p class="empty-state">Không có cảnh báo.</p>';
      return;
    }

    tidyWarnings.innerHTML = warnings
      .map((warning) => {
        const rule = warning.rule ? `[${warning.rule}] ` : "";
        return `<div class="warning-item">${escapeHtml(rule + warning.message)}</div>`;
      })
      .join("");
  }

  function entriesFromTidiedBibtex(bibtex) {
    const now = new Date().toISOString();
    return parseBibtexEntries(bibtex).map((entry) => ({
      id: entry.key,
      key: entry.key,
      entry: entry.entry,
      sourceMode: "bibtex-tidy",
      createdAt: now,
      updatedAt: now,
    }));
  }

  function openManualBibtexModal() {
    manualBibtexModal.classList.remove("hidden");
    manualBibtexInput.focus();
  }

  function closeManualBibtexModal() {
    manualBibtexModal.classList.add("hidden");
  }

  function saveManualBibtex() {
    const bibtex = manualBibtexInput.value.trim();
    if (!bibtex) {
      showNotification("Vui lòng dán hoặc tạo mã BibTeX trước khi lưu.", "warning");
      return;
    }

    const parsedEntries = parseBibtexEntries(bibtex, { preserveExistingKeys: true }).map((entry) => ({
      ...entry,
      sourceMode: "manual",
    }));
    if (!parsedEntries.length) {
      showNotification("Không tìm thấy mục BibTeX hợp lệ trong ô nhập.", "error");
      return;
    }

    const result = saveBibtexEntries(parsedEntries);
    if (result.savedEntries.length) {
      repositoryState.page = 1;
      renderRepository();
      manualBibtexInput.value = "";
      closeManualBibtexModal();
      showNotification(`Đã lưu ${result.savedEntries.length} mục BibTeX thủ công.`, "success");
    }
    if (result.skippedEntries.length) {
      showNotification(
        `Không lưu ${result.skippedEntries.length} mục vì key trùng hoặc không hợp lệ.`,
        "warning",
        result.skippedEntries.map((item) => item.reason)
      );
    }
  }

  function generateAiBibtex() {
    const sourceText = aiBibtexSource.value.trim();
    if (!sourceText) {
      showNotification("Vui lòng nhập thông tin bài viết cho AI.", "warning");
      return;
    }

    aiBibtexGenerate.disabled = true;
    aiBibtexGenerate.dataset.originalText = aiBibtexGenerate.textContent;
    aiBibtexGenerate.textContent = "Đang tạo...";

    fetch("/api/ai-bibtex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_text: sourceText }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          showNotification(data.error, "error");
          return;
        }

        manualBibtexInput.value = data.bibtex || data.output_text || "";
        showNotification("AI đã tạo mã BibTeX. Vui lòng kiểm tra trước khi lưu.", "success");
      })
      .catch(() => showNotification("Không thể gọi API tạo BibTeX bằng AI.", "error"))
      .finally(() => {
        aiBibtexGenerate.disabled = false;
        aiBibtexGenerate.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Tạo bằng AI';
      });
  }

  Object.entries(tabs).forEach(([mode, tab]) => {
    tab.addEventListener("click", () => setMode(mode));
  });

  uploadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      inputText.value = String(event.target.result || "");
      updateDuplicateWarning();
    };
    reader.readAsText(file);
  });

  inputText.addEventListener("input", updateDuplicateWarning);

  clearBtn.addEventListener("click", () => {
    inputText.value = "";
    outputText.value = "";
    fileInput.value = "";
    notificationArea.innerHTML = "";
    currentGeneratedEntries = [];
    updateDuplicateWarning();
    renderGeneratedEntries();
  });

  copyBtn.addEventListener("click", () => {
    if (!outputText.value) return;
    navigator.clipboard
      .writeText(outputText.value)
      .then(() => showNotification("Đã sao chép vào clipboard.", "success"))
      .catch(() => showNotification("Không thể sao chép.", "error"));
  });

  downloadBtn.addEventListener("click", () => {
    if (!outputText.value) return;
    const ext = conversionTypeInput.value === "bib2ris" ? "ris" : "bib";
    const blob = new Blob([outputText.value], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `converted_references.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });

  generatedEntries.addEventListener("input", (event) => {
    if (!event.target.classList.contains("bibtex-key-input")) return;
    const index = Number(event.target.dataset.index);
    const key = event.target.value.trim();
    if (!currentGeneratedEntries[index] || !key) return;

    currentGeneratedEntries[index].key = key;
    currentGeneratedEntries[index].entry = replaceBibtexKey(currentGeneratedEntries[index].entry, key);
    syncOutputFromGeneratedEntries();
    const preview = event.target.closest(".bibtex-entry-card")?.querySelector("pre");
    if (preview) preview.textContent = currentGeneratedEntries[index].entry;
  });

  generatedEntries.addEventListener("keydown", (event) => {
    if (!event.target.classList.contains("bibtex-key-input") || event.key !== "Enter") return;
    event.preventDefault();
    saveGeneratedEntry(Number(event.target.dataset.index));
  });

  generatedEntries.addEventListener("click", (event) => {
    if (!event.target.classList.contains("save-bibtex-entry")) return;
    saveGeneratedEntry(Number(event.target.dataset.index));
  });

  saveAllBibtexBtn.addEventListener("click", () => {
    if (!currentGeneratedEntries.length) return;
    const result = saveBibtexEntries(currentGeneratedEntries);
    currentGeneratedEntries = currentGeneratedEntries.filter((entry) => !result.savedEntries.includes(entry));
    syncOutputFromGeneratedEntries();
    renderGeneratedEntries();
    if (result.savedEntries.length) {
      showNotification(`Đã lưu ${result.savedEntries.length} mục BibTeX.`, "success");
    }
    if (result.skippedEntries.length) {
      showNotification(`Không lưu ${result.skippedEntries.length} mục vì key trùng hoặc không hợp lệ.`, "warning", result.skippedEntries.map((item) => item.reason));
    }
  });

  repositoryPageSize.addEventListener("change", () => {
    repositoryState.page = 1;
    renderRepository();
  });

  repositoryPagination.addEventListener("click", (event) => {
    if (event.target.classList.contains("repository-page-prev")) {
      repositoryState.page -= 1;
      renderRepository();
    }
    if (event.target.classList.contains("repository-page-next")) {
      repositoryState.page += 1;
      renderRepository();
    }
  });

  repositoryEntries.addEventListener("click", (event) => {
    const key = event.target.dataset.key;
    if (!key) return;
    const repository = getRepository();
    const item = repository.find((entry) => entry.key === key);

    if (event.target.classList.contains("copy-repository-entry") && item) {
      navigator.clipboard
        .writeText(`${item.entry}\n`)
        .then(() => showNotification(`Đã sao chép "${item.key}".`, "success"))
        .catch(() => showNotification("Không thể sao chép.", "error"));
    }

    if (event.target.classList.contains("view-repository-entry")) {
      openEntryModal("view", key);
    }

    if (event.target.classList.contains("edit-repository-entry")) {
      openEntryModal("edit", key);
    }

    if (event.target.classList.contains("delete-repository-entry")) {
      saveRepository(repository.filter((entry) => entry.key !== key));
      renderRepository();
      showNotification(`Đã xoá "${key}" khỏi kho BibTeX.`, "success");
    }
  });

  exportRepositoryBtn.addEventListener("click", () => {
    const content = getRepositoryBibtex();
    if (!content) return;
    const blob = new Blob([`${content}\n`], { type: "application/x-bibtex" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bibtex_repository.bib";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });

  clearRepositoryBtn.addEventListener("click", () => {
    if (!window.confirm("Xoá tất cả mục BibTeX đã lưu?")) return;
    saveRepository([]);
    repositoryState.page = 1;
    renderRepository();
    showNotification("Đã xoá kho BibTeX.", "success");
  });

  closeEntryModal.addEventListener("click", closeEntry);
  entryModal.addEventListener("click", (event) => {
    if (event.target === entryModal) closeEntry();
  });
  entryCopy.addEventListener("click", () => {
    if (!entryTextarea.value) return;
    navigator.clipboard
      .writeText(`${entryTextarea.value.trim()}\n`)
      .then(() => showNotification("Đã sao chép mục BibTeX.", "success"))
      .catch(() => showNotification("Không thể sao chép.", "error"));
  });
  entrySave.addEventListener("click", () => {
    if (entryModalMode !== "edit") return;
    const nextKey = entryKeyInput.value.trim();
    if (!nextKey) {
      showNotification("Bắt buộc nhập khoá trích dẫn.", "error");
      return;
    }

    const repository = getRepository();
    const duplicate = repository.some((entry) => entry.key === nextKey && entry.key !== activeEntryKey);
    if (duplicate) {
      showNotification(`Khoá trích dẫn "${nextKey}" đã tồn tại.`, "error");
      return;
    }

    const index = repository.findIndex((entry) => entry.key === activeEntryKey);
    if (index < 0) return;
    repository[index] = {
      ...repository[index],
      id: nextKey,
      key: nextKey,
      entry: replaceBibtexKey(entryTextarea.value.trim(), nextKey),
      updatedAt: new Date().toISOString(),
    };
    saveRepository(repository);
    closeEntry();
    renderRepository();
    showNotification(`Đã cập nhật "${nextKey}".`, "success");
  });

  managerBtn.addEventListener("click", () => {
    tidyResult = null;
    tidyApply.disabled = true;
    tidyPreview.value = getRepositoryBibtex();
    renderTidyWarnings([]);
    managerModal.classList.remove("hidden");
  });
  closeManager.addEventListener("click", () => managerModal.classList.add("hidden"));
  managerModal.addEventListener("click", (event) => {
    if (event.target === managerModal) managerModal.classList.add("hidden");
  });
  tidyCopyRepository.addEventListener("click", () => {
    const content = getRepositoryBibtex();
    if (!content) return;
    navigator.clipboard
      .writeText(`${content}\n`)
      .then(() => showNotification("Đã sao chép kho BibTeX.", "success"))
      .catch(() => showNotification("Không thể sao chép.", "error"));
  });
  tidyRun.addEventListener("click", () => {
    const bibtex = getRepositoryBibtex();
    if (!bibtex) {
      showNotification("Kho BibTeX đang trống.", "warning");
      return;
    }

    tidyRun.disabled = true;
    tidyApply.disabled = true;
    tidyWarnings.innerHTML = '<p class="empty-state">Đang chạy bibtex-tidy...</p>';

    fetch("/api/bibtex-tidy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bibtex, options: buildTidyOptions() }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          tidyResult = null;
          tidyPreview.value = "";
          renderTidyWarnings([{ message: data.error }]);
          showNotification(data.error, "error");
          return;
        }

        tidyResult = data;
        tidyPreview.value = data.bibtex || "";
        renderTidyWarnings(data.warnings || []);
        tidyApply.disabled = !tidyPreview.value.trim();
        showNotification(`bibtex-tidy đã xử lý ${data.count || 0} mục.`, "success");
      })
      .catch(() => {
        tidyResult = null;
        tidyPreview.value = "";
        renderTidyWarnings([{ message: "Không thể chạy bibtex-tidy." }]);
        showNotification("Không thể chạy bibtex-tidy.", "error");
      })
      .finally(() => {
        tidyRun.disabled = false;
      });
  });
  tidyApply.addEventListener("click", () => {
    if (!tidyResult || !tidyPreview.value.trim()) return;
    const entries = entriesFromTidiedBibtex(tidyPreview.value);
    saveRepository(entries);
    repositoryState.page = 1;
    renderRepository();
    managerModal.classList.add("hidden");
    showNotification(`Đã áp dụng kho BibTeX đã định dạng với ${entries.length} mục.`, "success");
  });

  manualBibtexBtn.addEventListener("click", openManualBibtexModal);
  closeManualBibtex.addEventListener("click", closeManualBibtexModal);
  manualBibtexModal.addEventListener("click", (event) => {
    if (event.target === manualBibtexModal) closeManualBibtexModal();
  });
  manualBibtexClear.addEventListener("click", () => {
    manualBibtexInput.value = "";
  });
  manualBibtexSave.addEventListener("click", saveManualBibtex);
  aiBibtexGenerate.addEventListener("click", generateAiBibtex);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const mode = conversionTypeInput.value;

    outputText.value = "Đang chuyển đổi...";
    convertBtn.disabled = true;
    currentGeneratedEntries = [];
    renderGeneratedEntries();

    fetch(endpointByMode[mode], { method: "POST", body: formData })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          outputText.value = "";
          showNotification(data.error, "error");
          return;
        }

        outputText.value = data.output_text || "";
        currentGeneratedEntries = isBibtexMode()
          ? parseBibtexEntries(outputText.value, { requestedKeys: data.citation_keys || [] })
          : [];
        renderGeneratedEntries();

        if (mode === "doi2bib" || mode === "isbn2bib") {
          const failed = Array.isArray(data.failed_lines) ? data.failed_lines.length : 0;
          const duplicates = Array.isArray(data.duplicate_lines) ? data.duplicate_lines.length : 0;
          const total = data.total || data.count || 0;
          const msg = failed
            ? `Đã chuyển đổi ${data.count}/${total}. Lỗi: ${failed}. Trùng lặp: ${duplicates}.`
            : `Đã chuyển đổi ${data.count}/${total}. Trùng lặp: ${duplicates}.`;
          showNotification(msg, failed ? "warning" : "success", [
            ...(data.duplicate_lines || []).slice(0, 3),
            ...(data.failed_lines || []).slice(0, 3),
          ]);
        } else {
          showNotification(`Đã chuyển đổi thành công ${data.count} mục.`, "success");
        }

        if (settings.autoCopy && outputText.value) {
          navigator.clipboard.writeText(outputText.value).catch(() => {});
        }
      })
      .catch(() => {
        outputText.value = "";
        showNotification("Đã xảy ra lỗi phía trình duyệt.", "error");
      })
      .finally(() => {
        convertBtn.disabled = false;
      });
  });

  document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || event.key !== "Enter" || event.repeat || convertBtn.disabled) return;
    event.preventDefault();
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(convertBtn);
    } else {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });

  settingsBtn.addEventListener("click", () => {
    applySettings();
    settingsModal.classList.remove("hidden");
  });
  closeSettings.addEventListener("click", () => settingsModal.classList.add("hidden"));
  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) settingsModal.classList.add("hidden");
  });
  resetSettingsBtn.addEventListener("click", () => {
    settings = { ...defaultSettings };
    applySettings();
  });
  saveSettingsBtn.addEventListener("click", () => {
    settings = { autoCopy: autoCopyToggle.checked, editMode: editModeToggle.checked };
    saveSettings(settings);
    applySettings();
    settingsModal.classList.add("hidden");
    showNotification("Đã lưu cài đặt.", "success");
  });

  applySavedGridHeight();
  watchGridHeight();
  applySettings();
  renderRepository();
  setMode("bib2ris");
});
