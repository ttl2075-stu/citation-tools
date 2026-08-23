/**
 * Citation to BibTeX - Popup Script
 * Universal citation extractor supporting DOI, arXiv, ISBN, and metadata
 */

const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i;
const ARXIV_REGEX = /\b(?:arXiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})\b/i;
const ISBN_REGEX = /\b(?:97[89][- ]?)?(?:\d[- ]?){9}[\dxX]\b/;

// DOM Elements
const inputIdentifier = document.getElementById('input-identifier');
const citekeyInput = document.getElementById('citekey-input');
const btnClear = document.getElementById('btn-clear');
const btnFetch = document.getElementById('btn-fetch');
const typeDetectorBadge = document.getElementById('type-detector-badge');
const toggleAutocopy = document.getElementById('toggle-autocopy');
const detectedBanner = document.getElementById('detected-banner');
const detectedText = document.getElementById('detected-text');
const refSelect = document.getElementById('ref-select');
const statusBox = document.getElementById('status-box');
const resultSection = document.getElementById('result-section');
const entryTypeBadge = document.getElementById('entry-type-badge');
const sourceBadge = document.getElementById('source-badge');
const copyToastBadge = document.getElementById('copy-toast-badge');
const bibtexOutput = document.getElementById('bibtex-output');
const btnCopy = document.getElementById('btn-copy');
const copyBtnText = document.getElementById('copy-btn-text');
const btnDownload = document.getElementById('btn-download');
const btnSendWebapp = document.getElementById('btn-send-webapp');
const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');

let currentBibtex = '';
let currentIdentifier = '';
let currentPageData = null;

function cleanDoi(raw) {
  if (!raw) return '';
  let doi = String(raw).trim().replace(/^<|>$/g, '');
  doi = doi.replace(/^doi\s*:\s*/i, '');
  doi = doi.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '');
  doi = doi.replace(/[.,;)]+$/, '');
  return doi.trim();
}

function detectInputType(raw) {
  if (!raw) return null;
  const text = raw.trim();
  if (DOI_REGEX.test(text)) return { type: 'doi', label: 'DOI' };
  if (ARXIV_REGEX.test(text) || text.includes('arxiv.org')) return { type: 'arxiv', label: 'arXiv' };
  if (ISBN_REGEX.test(text)) return { type: 'isbn', label: 'ISBN' };
  if (text.startsWith('http://') || text.startsWith('https://')) return { type: 'url', label: 'URL' };
  return { type: 'text', label: 'Reference' };
}

function updateTypeBadge(text) {
  const detected = detectInputType(text);
  if (detected && text.trim().length > 2) {
    typeDetectorBadge.textContent = detected.label;
    typeDetectorBadge.classList.remove('hidden');
  } else {
    typeDetectorBadge.classList.add('hidden');
  }
}

function formatBibtex(raw) {
  const text = (raw || '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text.startsWith('@')) return text;

  const openBrace = text.indexOf('{');
  const closeBrace = text.lastIndexOf('}');
  if (openBrace === -1 || closeBrace === -1 || closeBrace <= openBrace) return text;

  const header = text.slice(0, openBrace + 1).trim();
  const inner = text.slice(openBrace + 1, closeBrace).trim();

  const parts = [];
  let current = [];
  let depth = 0;
  let inQuotes = false;
  let escaped = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (escaped) {
      current.push(char);
      escaped = false;
      continue;
    }
    if (char === '\\') {
      current.push(char);
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      current.push(char);
      continue;
    }
    if (!inQuotes) {
      if (char === '{') depth++;
      else if (char === '}') depth = Math.max(0, depth - 1);
      else if (char === ',' && depth === 0) {
        const part = current.join('').trim();
        if (part) parts.push(part);
        current = [];
        continue;
      }
    }
    current.push(char);
  }
  const tail = current.join('').trim();
  if (tail) parts.push(tail);

  if (parts.length === 0) return text;

  const citeKey = parts[0].trim();
  const fields = parts.slice(1).map(p => p.trim().replace(/,$/, '')).filter(Boolean);

  const lines = [`${header}${citeKey},`];
  fields.forEach((field, idx) => {
    let formattedField = field;
    if (field.includes('=')) {
      const eqIdx = field.indexOf('=');
      const k = field.slice(0, eqIdx).trim();
      const v = field.slice(eqIdx + 1).trim();
      formattedField = `${k} = ${v}`;
    }
    const suffix = idx < fields.length - 1 ? ',' : '';
    lines.push(`  ${formattedField}${suffix}`);
  });
  lines.push('}');
  return lines.join('\n');
}

function replaceCiteKey(bibtex, newKey) {
  if (!newKey) return bibtex;
  const sanitizedKey = newKey.trim();
  return bibtex.replace(/^(@[^{\s]+\s*{\s*)([^,\s]+)(\s*,)/, `$1${sanitizedKey}$3`);
}

function getEntryType(bibtex) {
  const match = bibtex.match(/^@([a-zA-Z]+)/);
  return match ? `@${match[1].toLowerCase()}` : '@article';
}

function showStatus(message, type = 'error') {
  statusBox.textContent = message;
  statusBox.className = `status-box ${type}`;
  statusBox.classList.remove('hidden');
}

function hideStatus() {
  statusBox.classList.add('hidden');
}

function setLoading(isLoading) {
  btnFetch.disabled = isLoading;
  const btnText = btnFetch.querySelector('.btn-text');
  const spinner = btnFetch.querySelector('.spinner');
  if (isLoading) {
    btnText.textContent = 'Đang trích xuất...';
    spinner.classList.remove('hidden');
  } else {
    btnText.textContent = 'Trích xuất mã BibTeX';
    spinner.classList.add('hidden');
  }
}

async function copyOutputToClipboard(silent = false) {
  if (!bibtexOutput.value) return;
  try {
    await navigator.clipboard.writeText(bibtexOutput.value);
    if (!silent) {
      copyBtnText.textContent = 'Đã sao chép ✓';
      btnCopy.classList.remove('btn-success');
      btnCopy.classList.add('btn-primary');
      setTimeout(() => {
        copyBtnText.textContent = 'Sao chép BibTeX';
        btnCopy.classList.remove('btn-primary');
        btnCopy.classList.add('btn-success');
      }, 2000);
    }
    // Show top toast
    copyToastBadge.classList.remove('hidden');
    setTimeout(() => {
      copyToastBadge.classList.add('hidden');
    }, 2500);
  } catch (err) {
    if (!silent) showStatus('Không thể sao chép vào clipboard.');
  }
}

// Fetchers
async function fetchDoi(doi) {
  const clean = cleanDoi(doi);
  const response = await fetch(`https://doi.org/${encodeURIComponent(clean)}`, {
    headers: { 'Accept': 'application/x-bibtex; charset=utf-8' }
  });
  if (!response.ok) {
    throw new Error(`Dịch vụ DOI trả về lỗi HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

async function fetchIsbn(isbn) {
  const clean = isbn.replace(/[- ]/g, '');
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${clean}.json`);
    if (res.ok) {
      const data = await res.json();
      const title = data.title || 'Unknown Title';
      const year = data.publish_date ? (data.publish_date.match(/\d{4}/) || [''])[0] : '';
      const publishers = (data.publishers || []).join(', ');
      const key = `book_${clean.slice(-6)}_${year || 'ref'}`;
      
      const lines = [
        `@book{${key},`,
        `  title = {${title}},`,
        data.number_of_pages ? `  pages = {${data.number_of_pages}},` : '',
        publishers ? `  publisher = {${publishers}},` : '',
        year ? `  year = {${year}},` : '',
        `  isbn = {${clean}}`,
        `}`
      ].filter(Boolean);
      return lines.join('\n');
    }
  } catch (e) {
    // Continue
  }

  // Fallback to backend API
  const endpoints = ['https://bib2ris.long.pro.vn/api/isbn-to-bibtex', 'http://127.0.0.1:5000/api/isbn-to-bibtex'];
  for (const ep of endpoints) {
    try {
      const fd = new FormData();
      fd.append('input_text', clean);
      const res = await fetch(ep, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.output_text) return data.output_text;
      }
    } catch (e) {}
  }
  throw new Error(`Không tìm thấy thông tin sách cho mã ISBN: ${clean}`);
}

function constructFromMetadata(meta) {
  if (!meta || !meta.title) return null;
  const authors = (meta.authors || []).join(' and ');
  const year = meta.year || (meta.pubDate ? (meta.pubDate.match(/\d{4}/) || [''])[0] : '');
  const firstAuthor = (meta.authors && meta.authors[0]) ? meta.authors[0].split(',')[0].split(' ').pop().toLowerCase() : 'ref';
  const key = `${firstAuthor}${year || 'paper'}`;

  const entryType = meta.journal ? '@article' : '@misc';
  const lines = [
    `${entryType}{${key},`,
    `  title = {${meta.title}},`,
    authors ? `  author = {${authors}},` : '',
    meta.journal ? `  journal = {${meta.journal}},` : '',
    year ? `  year = {${year}},` : '',
    meta.volume ? `  volume = {${meta.volume}},` : '',
    meta.issue ? `  number = {${meta.issue}},` : '',
    meta.pages ? `  pages = {${meta.pages}},` : '',
    meta.publisher ? `  publisher = {${meta.publisher}},` : '',
    meta.url ? `  url = {${meta.url}},` : ''
  ].filter(Boolean);
  lines.push('}');
  return lines.join('\n');
}

// Master extraction function
async function processExtraction(rawInput, customKey = '') {
  hideStatus();
  setLoading(true);

  try {
    const text = (rawInput || '').trim();
    if (!text) {
      throw new Error('Vui lòng nhập mã DOI, arXiv, ISBN hoặc thông tin bài viết.');
    }

    let bibtexRaw = '';
    let sourceType = 'DOI';
    let targetIdent = text;

    // 1. Check DOI
    const doiMatch = text.match(DOI_REGEX);
    if (doiMatch) {
      const doi = cleanDoi(doiMatch[0]);
      targetIdent = doi;
      sourceType = 'DOI.org';
      bibtexRaw = await fetchDoi(doi);
    } 
    // 2. Check arXiv
    else if (ARXIV_REGEX.test(text) || text.includes('arxiv.org')) {
      const match = text.match(ARXIV_REGEX) || text.match(/arxiv\.org\/(?:abs|pdf)\/([^\s/?#]+)/i);
      const arxivId = (match[1] || match[0]).replace(/^arxiv:\s*/i, '').trim();
      targetIdent = `arXiv:${arxivId}`;
      sourceType = 'arXiv / DOI';
      // arXiv DOIs
      bibtexRaw = await fetchDoi(`10.48550/arXiv.${arxivId}`);
    } 
    // 3. Check ISBN
    else if (ISBN_REGEX.test(text)) {
      const match = text.match(ISBN_REGEX);
      const isbn = match[0].replace(/[- ]/g, '');
      targetIdent = `ISBN ${isbn}`;
      sourceType = 'OpenLibrary';
      bibtexRaw = await fetchIsbn(isbn);
    } 
    // 4. Try metadata if matched from page
    else if (currentPageData && currentPageData.metadata && currentPageData.metadata.title) {
      sourceType = 'Page Meta';
      targetIdent = currentPageData.metadata.title;
      bibtexRaw = constructFromMetadata(currentPageData.metadata);
      if (!bibtexRaw) {
        throw new Error('Không thể tạo BibTeX từ thông tin hiện tại.');
      }
    } else {
      throw new Error('Không nhận diện được DOI, arXiv ID hoặc ISBN hợp lệ.');
    }

    let formatted = formatBibtex(bibtexRaw);
    if (customKey) {
      formatted = replaceCiteKey(formatted, customKey);
    }

    currentBibtex = formatted;
    currentIdentifier = targetIdent;

    bibtexOutput.value = formatted;
    entryTypeBadge.textContent = getEntryType(formatted);
    sourceBadge.textContent = sourceType;
    resultSection.classList.remove('hidden');

    saveHistory(targetIdent, sourceType, formatted);

    // Auto copy to clipboard if enabled
    if (toggleAutocopy.checked) {
      await copyOutputToClipboard(true);
    }
  } catch (err) {
    resultSection.classList.add('hidden');
    showStatus(err.message || 'Đã có lỗi xảy ra khi trích xuất BibTeX.');
  } finally {
    setLoading(false);
  }
}

// History Storage
function saveHistory(identifier, type, bibtex) {
  chrome.storage.local.get({ recentBibtex: [] }, (data) => {
    let history = data.recentBibtex || [];
    history = history.filter(item => item.identifier !== identifier);
    history.unshift({
      identifier,
      type: type.toLowerCase(),
      bibtex,
      timestamp: Date.now()
    });
    chrome.storage.local.set({ recentBibtex: history.slice(0, 15) }, loadHistory);
  });
}

function loadHistory() {
  chrome.storage.local.get({ recentBibtex: [] }, (data) => {
    const history = data.recentBibtex || [];
    historyCount.textContent = history.length;
    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<p class="empty-history">Chưa có lịch sử tra cứu.</p>';
      return;
    }

    history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'history-item';

      const tag = document.createElement('span');
      tag.className = 'history-tag';
      tag.textContent = item.type || 'ref';

      const label = document.createElement('span');
      label.className = 'history-doi';
      label.textContent = item.identifier;
      label.title = item.identifier;

      const btn = document.createElement('button');
      btn.className = 'history-btn';
      btn.textContent = 'Xem';
      btn.addEventListener('click', () => {
        inputIdentifier.value = item.identifier;
        btnClear.classList.remove('hidden');
        updateTypeBadge(item.identifier);
        currentBibtex = item.bibtex;
        currentIdentifier = item.identifier;
        bibtexOutput.value = item.bibtex;
        entryTypeBadge.textContent = getEntryType(item.bibtex);
        sourceBadge.textContent = item.type.toUpperCase();
        resultSection.classList.remove('hidden');
        hideStatus();
      });

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.overflow = 'hidden';
      left.appendChild(tag);
      left.appendChild(label);

      row.appendChild(left);
      row.appendChild(btn);
      historyList.appendChild(row);
    });
  });
}

// Auto-detect reference on tab
async function initTabDetection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_REFERENCE' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      currentPageData = response;

      const items = [];
      if (response.primaryDoi) {
        response.allDois.forEach((d, i) => items.push({ type: 'DOI', value: d, label: `DOI: ${d}` }));
      }
      if (response.arxivId) {
        items.push({ type: 'arXiv', value: `arXiv:${response.arxivId}`, label: `arXiv: ${response.arxivId}` });
      }
      if (response.isbn) {
        items.push({ type: 'ISBN', value: response.isbn, label: `ISBN: ${response.isbn}` });
      }
      if (items.length === 0 && response.metadata && response.metadata.title) {
        items.push({ type: 'Meta', value: response.metadata.title, label: `Tiêu đề: ${response.metadata.title.slice(0, 30)}...` });
      }

      if (items.length > 0) {
        detectedBanner.classList.remove('hidden');
        inputIdentifier.value = items[0].value;
        btnClear.classList.remove('hidden');
        updateTypeBadge(items[0].value);

        if (items.length > 1) {
          detectedText.textContent = `Phát hiện (${items.length}):`;
          refSelect.innerHTML = '';
          items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value;
            opt.textContent = item.label;
            refSelect.appendChild(opt);
          });
          refSelect.classList.remove('hidden');
          refSelect.addEventListener('change', () => {
            inputIdentifier.value = refSelect.value;
            updateTypeBadge(refSelect.value);
            processExtraction(refSelect.value, citekeyInput.value);
          });
        }

        // Auto extract immediately
        processExtraction(items[0].value, citekeyInput.value);
      }
    });
  } catch (e) {
    console.log('Tab detection error:', e);
  }
}

// Event Listeners
inputIdentifier.addEventListener('input', () => {
  const val = inputIdentifier.value.trim();
  if (val) {
    btnClear.classList.remove('hidden');
  } else {
    btnClear.classList.add('hidden');
  }
  updateTypeBadge(val);
});

btnClear.addEventListener('click', () => {
  inputIdentifier.value = '';
  citekeyInput.value = '';
  btnClear.classList.add('hidden');
  resultSection.classList.add('hidden');
  typeDetectorBadge.classList.add('hidden');
  hideStatus();
  inputIdentifier.focus();
});

btnFetch.addEventListener('click', () => {
  processExtraction(inputIdentifier.value, citekeyInput.value);
});

inputIdentifier.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    btnFetch.click();
  }
});

citekeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnFetch.click();
  }
});

citekeyInput.addEventListener('input', () => {
  if (currentBibtex && bibtexOutput.value) {
    const updated = replaceCiteKey(currentBibtex, citekeyInput.value);
    bibtexOutput.value = updated;
  }
});

// Auto-copy toggle persistence
toggleAutocopy.addEventListener('change', () => {
  chrome.storage.local.set({ autoCopy: toggleAutocopy.checked });
});

btnCopy.addEventListener('click', () => {
  copyOutputToClipboard(false);
});

btnDownload.addEventListener('click', () => {
  if (!bibtexOutput.value) return;
  const blob = new Blob([bibtexOutput.value], { type: 'application/x-bibtex;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (currentIdentifier || 'citation').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeName}.bib`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

btnSendWebapp.addEventListener('click', () => {
  const url = 'https://bib2ris.long.pro.vn';
  chrome.tabs.create({ url });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ autoCopy: true }, (data) => {
    toggleAutocopy.checked = data.autoCopy !== false;
  });
  loadHistory();
  initTabDetection();
});
