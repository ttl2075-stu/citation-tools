/**
 * Citation to BibTeX - Background Service Worker (Manifest V3)
 * Supports Context Menus, auto clipboard copy, notifications, and reference parsing.
 */

const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i;
const ARXIV_REGEX = /\b(?:arXiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})\b/i;
const ISBN_REGEX = /\b(?:97[89][- ]?)?(?:\d[- ]?){9}[\dxX]\b/;

function cleanDoi(raw) {
  if (!raw) return '';
  let doi = String(raw).trim().replace(/^<|>$/g, '');
  doi = doi.replace(/^doi\s*:\s*/i, '');
  doi = doi.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '');
  doi = doi.replace(/[.,;)]+$/, '');
  return doi.trim();
}

function parseIdentifier(text) {
  if (!text) return null;
  const raw = text.trim();

  // 1. Check DOI
  const doiMatch = raw.match(DOI_REGEX);
  if (doiMatch) {
    return { type: 'doi', value: cleanDoi(doiMatch[0]) };
  }

  // 2. Check arXiv ID
  const arxivMatch = raw.match(ARXIV_REGEX) || raw.match(/arxiv\.org\/(?:abs|pdf)\/([^\s/?#]+)/i);
  if (arxivMatch) {
    const arxivId = (arxivMatch[1] || arxivMatch[0]).replace(/^arxiv:\s*/i, '').trim();
    // arXiv IDs can be queried via doi.org using prefix 10.48550/arXiv.
    const arxivDoi = `10.48550/arXiv.${arxivId}`;
    return { type: 'arxiv', value: arxivDoi, rawId: arxivId };
  }

  // 3. Check ISBN
  const isbnMatch = raw.match(ISBN_REGEX);
  if (isbnMatch) {
    return { type: 'isbn', value: isbnMatch[0].replace(/[- ]/g, '') };
  }

  return { type: 'text', value: raw };
}

// Pretty format raw BibTeX
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

// Fetch BibTeX for DOI or arXiv
async function fetchBibtexByDoi(doi) {
  const url = `https://doi.org/${encodeURIComponent(doi)}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/x-bibtex; charset=utf-8'
    }
  });

  if (!response.ok) {
    throw new Error(`Dịch vụ DOI trả về HTTP ${response.status}: ${response.statusText}`);
  }

  const bibtex = await response.text();
  return formatBibtex(bibtex);
}

// Fetch BibTeX for ISBN via OpenLibrary/Crossref/GoogleBooks
async function fetchBibtexByIsbn(isbn) {
  // Try OpenLibrary first
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
    if (res.ok) {
      const data = await res.json();
      const title = data.title || 'Unknown Title';
      const year = data.publish_date ? (data.publish_date.match(/\d{4}/) || [''])[0] : '';
      const publishers = (data.publishers || []).join(', ');
      const key = `book_${isbn.slice(-6)}_${year || 'ref'}`;
      
      const lines = [
        `@book{${key},`,
        `  title = {${title}},`,
        data.number_of_pages ? `  pages = {${data.number_of_pages}},` : '',
        publishers ? `  publisher = {${publishers}},` : '',
        year ? `  year = {${year}},` : '',
        `  isbn = {${isbn}}`,
        `}`
      ].filter(Boolean);
      return formatBibtex(lines.join('\n'));
    }
  } catch (e) {
    // Continue fallback
  }

  // Fallback to backend API if reachable
  const endpoints = ['https://bib2ris.long.pro.vn/api/isbn-to-bibtex', 'http://127.0.0.1:5000/api/isbn-to-bibtex'];
  for (const ep of endpoints) {
    try {
      const formData = new FormData();
      formData.append('input_text', isbn);
      const res = await fetch(ep, { method: 'POST', body: formData });
      if (res.ok) {
        const json = await res.json();
        if (json.output_text) return formatBibtex(json.output_text);
      }
    } catch (e) {
      // Continue next endpoint
    }
  }

  throw new Error(`Không tìm thấy thông tin sách cho mã ISBN ${isbn}.`);
}

// Execute Auto Copy to Clipboard on Tab
async function copyToClipboard(tabId, text) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (contentToCopy) => {
        navigator.clipboard.writeText(contentToCopy);
      },
      args: [text]
    });
    return true;
  } catch (err) {
    console.error('Lỗi sao chép vào clipboard:', err);
    return false;
  }
}

// Create Context Menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'get-bibtex-selection',
    title: 'Trích xuất BibTeX từ nội dung đã chọn (DOI / arXiv / ISBN)',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'get-bibtex-link',
    title: 'Trích xuất BibTeX từ liên kết này',
    contexts: ['link']
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const targetText = (info.menuItemId === 'get-bibtex-selection') ? info.selectionText : info.linkUrl;
  const parsed = parseIdentifier(targetText);

  if (!parsed || !parsed.value) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Không nhận diện được trích dẫn',
      message: 'Vui lòng bôi đen hoặc chọn liên kết chứa mã DOI, arXiv, ISBN hoặc tài liệu tham khảo.'
    });
    return;
  }

  try {
    let bibtex = '';
    if (parsed.type === 'doi' || parsed.type === 'arxiv') {
      bibtex = await fetchBibtexByDoi(parsed.value);
    } else if (parsed.type === 'isbn') {
      bibtex = await fetchBibtexByIsbn(parsed.value);
    } else {
      // Free-form text: try extracting DOI inside
      const doiInside = cleanDoi(parsed.value);
      if (doiInside) {
        bibtex = await fetchBibtexByDoi(doiInside);
      } else {
        throw new Error('Nội dung đã chọn không chứa DOI hoặc ISBN hợp lệ.');
      }
    }

    // Auto copy into clipboard
    if (tab && tab.id) {
      await copyToClipboard(tab.id, bibtex);
    }

    // Save to recent history
    chrome.storage.local.get({ recentBibtex: [] }, (data) => {
      const history = data.recentBibtex || [];
      history.unshift({
        identifier: parsed.value,
        type: parsed.type,
        bibtex,
        timestamp: Date.now()
      });
      chrome.storage.local.set({ recentBibtex: history.slice(0, 20) });
    });

    const keyMatch = bibtex.match(/^@[a-zA-Z]+\{([^,\s]+)/);
    const key = keyMatch ? keyMatch[1] : parsed.value;

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '✓ Đã tự động sao chép BibTeX vào Clipboard!',
      message: `Đã trích xuất trích dẫn [${key}] thành công. Bạn có thể nhấn Ctrl+V / Cmd+V để dán.`
    });
  } catch (err) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Lỗi trích xuất BibTeX',
      message: err.message || 'Không thể lấy dữ liệu từ dịch vụ trích dẫn.'
    });
  }
});

// Update Badge when references detected
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === 'REFERENCE_DETECTED' && sender.tab && sender.tab.id) {
    const data = request.data || {};
    const count = (data.allDois ? data.allDois.length : 0) + (data.arxivId ? 1 : 0) + (data.isbn ? 1 : 0);
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: count > 0 ? (count > 1 ? String(count) : 'REF') : ''
    });
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: '#4f46e5'
    });
  }
});
