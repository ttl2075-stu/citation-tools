/**
 * Citation to BibTeX - Content Script
 * Scrapes metadata from academic publication pages (DOI, arXiv, ISBN, Citation Meta)
 */

(function () {
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

  function isValidDoi(doi) {
    return /^10\.\d{4,9}\/\S+$/i.test(doi);
  }

  function getMetaContents(names) {
    const values = [];
    names.forEach(name => {
      const selectors = [
        `meta[name="${name}" i]`,
        `meta[property="${name}" i]`
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const val = el.getAttribute('content') || el.getAttribute('value');
          if (val && !values.includes(val.trim())) {
            values.push(val.trim());
          }
        });
      });
    });
    return values;
  }

  function getMetaFirst(names) {
    const list = getMetaContents(names);
    return list.length > 0 ? list[0] : '';
  }

  function detectPageReferences() {
    // 1. DOIs
    const doiMeta = getMetaContents([
      'citation_doi', 'dc.identifier', 'dc.identifier.doi', 
      'prism.doi', 'bepress_citation_doi', 'doi', 'og:doi', 'article:doi'
    ]);
    const dois = [];
    doiMeta.forEach(m => {
      const cleaned = cleanDoi(m);
      if (cleaned && isValidDoi(cleaned) && !dois.includes(cleaned)) dois.push(cleaned);
    });

    // Check URL for DOI
    const urlMatch = window.location.href.match(DOI_REGEX);
    if (urlMatch) {
      const cleaned = cleanDoi(urlMatch[0]);
      if (cleaned && isValidDoi(cleaned) && !dois.includes(cleaned)) dois.unshift(cleaned);
    }

    // Check links for DOI
    document.querySelectorAll('a[href*="doi.org/10."], a[href*="/10."]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const match = href.match(DOI_REGEX);
      if (match) {
        const cleaned = cleanDoi(match[0]);
        if (cleaned && isValidDoi(cleaned) && !dois.includes(cleaned)) dois.push(cleaned);
      }
    });

    // 2. arXiv ID
    let arxivId = getMetaFirst(['citation_arxiv_id', 'arxiv_id']);
    if (!arxivId) {
      const arxivMatch = window.location.href.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})/i);
      if (arxivMatch) arxivId = arxivMatch[1];
    }
    if (!arxivId && window.location.hostname.includes('arxiv.org')) {
      const bodyMatch = document.body ? document.body.innerText.match(ARXIV_REGEX) : null;
      if (bodyMatch) arxivId = bodyMatch[1] || bodyMatch[0];
    }

    // 3. ISBN
    let isbn = getMetaFirst(['citation_isbn', 'isbn']);
    if (!isbn) {
      const isbnMatch = document.body ? document.body.innerText.match(ISBN_REGEX) : null;
      if (isbnMatch) isbn = isbnMatch[0];
    }

    // 4. General Scholarly Metadata
    const title = getMetaFirst(['citation_title', 'dc.title', 'og:title', 'title']) || document.title || '';
    const authors = getMetaContents(['citation_author', 'dc.creator', 'author']);
    const journal = getMetaFirst(['citation_journal_title', 'citation_conference_title', 'prism.publicationName', 'journal']);
    const pubDate = getMetaFirst(['citation_publication_date', 'citation_date', 'citation_year', 'dc.date']);
    const volume = getMetaFirst(['citation_volume', 'prism.volume']);
    const issue = getMetaFirst(['citation_issue', 'prism.number']);
    const firstPage = getMetaFirst(['citation_firstpage']);
    const lastPage = getMetaFirst(['citation_lastpage']);
    const publisher = getMetaFirst(['citation_publisher', 'dc.publisher']);
    const abstract = getMetaFirst(['citation_abstract', 'dc.description', 'description', 'og:description']);

    let year = '';
    if (pubDate) {
      const yMatch = pubDate.match(/\b(19\d{2}|20\d{2})\b/);
      if (yMatch) year = yMatch[1];
    }

    const pages = firstPage ? (lastPage ? `${firstPage}--${lastPage}` : firstPage) : '';

    return {
      primaryDoi: dois.length > 0 ? dois[0] : null,
      allDois: dois,
      arxivId: arxivId ? arxivId.replace(/^arxiv:\s*/i, '').trim() : null,
      isbn: isbn ? isbn.replace(/[- ]/g, '').trim() : null,
      metadata: {
        title,
        authors,
        journal,
        year,
        pubDate,
        volume,
        issue,
        pages,
        publisher,
        abstract,
        url: window.location.href
      }
    };
  }

  // Notify background script
  const pageRef = detectPageReferences();
  if (pageRef.primaryDoi || pageRef.arxivId || pageRef.isbn) {
    try {
      chrome.runtime.sendMessage({
        action: 'REFERENCE_DETECTED',
        data: pageRef
      });
    } catch (e) {
      // Background worker might not be initialized yet
    }
  }

  // Listen for queries from popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_PAGE_REFERENCE' || request.action === 'GET_PAGE_DOI') {
      sendResponse(detectPageReferences());
    }
    return true;
  });
})();
