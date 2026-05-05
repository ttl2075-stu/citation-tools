from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DOI_URL_RE = re.compile(r"^(?:https?://)?(?:dx\.)?doi\.org/(?P<doi>.+)$", re.IGNORECASE)
DOI_RAW_RE = re.compile(r"^10\.\d{4,9}/\S+$", re.IGNORECASE)


@dataclass
class DOIConversionResult:
    output_text: str
    success_count: int
    total_count: int
    input_count: int
    failed_lines: List[str]
    duplicate_lines: List[str]


def _split_top_level_csv(text: str) -> List[str]:
    """Split a BibTeX entry body by top-level commas only."""
    parts: List[str] = []
    current: List[str] = []
    brace_depth = 0
    in_quotes = False
    escaped = False

    for char in text:
        if escaped:
            current.append(char)
            escaped = False
            continue

        if char == "\\":
            current.append(char)
            escaped = True
            continue

        if char == '"':
            in_quotes = not in_quotes
            current.append(char)
            continue

        if not in_quotes:
            if char == "{":
                brace_depth += 1
            elif char == "}":
                brace_depth = max(0, brace_depth - 1)
            elif char == "," and brace_depth == 0:
                part = "".join(current).strip()
                if part:
                    parts.append(part)
                current = []
                continue

        current.append(char)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def format_bibtex_entry(raw_bibtex: str) -> str:
    """Pretty-format a BibTeX entry returned by DOI content negotiation."""
    text = raw_bibtex.strip().replace("\r\n", "\n").replace("\r", "\n")
    if not text.startswith("@"):
        return text

    opening_brace = text.find("{")
    closing_brace = text.rfind("}")
    if opening_brace == -1 or closing_brace == -1 or closing_brace <= opening_brace:
        return text

    header = text[: opening_brace + 1].strip()
    inner = text[opening_brace + 1 : closing_brace].strip()
    parts = _split_top_level_csv(inner)
    if not parts:
        return text

    cite_key = parts[0].strip()
    fields = [part.strip().rstrip(",") for part in parts[1:] if part.strip()]

    lines = [f"{header}{cite_key},"]
    for index, field in enumerate(fields):
        if "=" in field:
            field_name, field_value = field.split("=", 1)
            field = f"{field_name.strip()} = {field_value.strip()}"
        suffix = "," if index < len(fields) - 1 else ""
        lines.append(f"  {field}{suffix}")
    lines.append("}")
    return "\n".join(lines)


def normalize_doi(raw: str) -> str:
    """Normalize DOI input from raw DOI or doi.org URL forms."""
    value = raw.strip()
    if not value:
        return ""

    value = value.strip("<>")
    value = re.sub(r"^doi\s*:\s*", "", value, flags=re.IGNORECASE)

    match = DOI_URL_RE.match(value)
    if match:
        value = match.group("doi").strip()

    value = value.strip().rstrip(".;,")

    if not DOI_RAW_RE.match(value):
        raise ValueError("Định dạng DOI không hợp lệ")

    return value.lower()


def extract_dois_from_lines(text: str) -> tuple[List[str], List[str], List[str], int]:
    """Extract unique DOIs from lines, tracking invalid and duplicate inputs."""
    valid: List[str] = []
    failed: List[str] = []
    duplicates: List[str] = []
    seen: set[str] = set()
    input_count = 0

    for idx, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        input_count += 1
        try:
            doi = normalize_doi(line)
            if doi in seen:
                duplicates.append(f"Dòng {idx}: {line.strip()} -> {doi}")
                continue
            seen.add(doi)
            valid.append(doi)
        except ValueError as exc:
            failed.append(f"Dòng {idx}: {line.strip()} ({exc})")

    return valid, failed, duplicates, input_count


def fetch_doi_bibtex(doi: str) -> str:
    """Fetch BibTeX text by DOI content negotiation."""
    req = Request(
        f"https://doi.org/{doi}",
        headers={
            "Accept": "application/x-bibtex; charset=utf-8",
            "User-Agent": "bibtex2ris-web/1.0",
        },
    )

    try:
        with urlopen(req, timeout=15) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace").strip()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip() or exc.reason
        raise ValueError(f"Lỗi dịch vụ DOI ({exc.code}): {detail}") from exc
    except URLError as exc:
        raise ValueError(f"Không thể kết nối tới dịch vụ DOI: {exc.reason}") from exc


def fetch_doi_citation(doi: str, style: str, lang: str) -> str:
    """Fetch a formatted citation from citation.doi.org."""
    params = urlencode({"doi": doi, "style": style, "lang": lang})
    req = Request(
        f"https://citation.doi.org/format?{params}",
        headers={
            "Accept": "text/plain; charset=utf-8",
            "User-Agent": "bibtex2ris-web/1.0",
        },
    )

    try:
        with urlopen(req, timeout=15) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace").strip()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip() or exc.reason
        raise ValueError(f"Lỗi dịch vụ DOI ({exc.code}): {detail}") from exc
    except URLError as exc:
        raise ValueError(f"Không thể kết nối tới dịch vụ DOI: {exc.reason}") from exc


def convert_doi_lines(text: str, style: str = "bibtex", lang: str = "en-US") -> DOIConversionResult:
    """Convert one DOI per line to BibTeX (default) or selected citation style."""
    style_normalized = (style or "bibtex").strip().lower()
    lang_normalized = (lang or "en-US").strip() or "en-US"

    valid_dois, failed_lines, duplicate_lines, input_count = extract_dois_from_lines(text)
    if not valid_dois and failed_lines:
        raise ValueError("Không tìm thấy DOI hợp lệ. Vui lòng nhập mỗi dòng một DOI.")
    if not valid_dois:
        raise ValueError("Chưa có DOI. Vui lòng nhập mỗi dòng một DOI.")

    output_chunks: List[str] = []

    for doi in valid_dois:
        try:
            if style_normalized == "bibtex":
                output_chunks.append(format_bibtex_entry(fetch_doi_bibtex(doi)))
            else:
                output_chunks.append(fetch_doi_citation(doi, style_normalized, lang_normalized))
        except Exception as exc:
            failed_lines.append(f"DOI {doi}: {exc}")

    if not output_chunks:
        raise ValueError("Không thể lấy kết quả DOI nào từ dịch vụ từ xa.")

    separator = "\n\n" if style_normalized == "bibtex" else "\n\n---\n\n"
    output_text = separator.join(chunk for chunk in output_chunks if chunk).strip()
    if output_text:
        output_text += "\n"

    return DOIConversionResult(
        output_text=output_text,
        success_count=len(output_chunks),
        total_count=len(valid_dois),
        input_count=input_count,
        failed_lines=failed_lines,
        duplicate_lines=duplicate_lines,
    )



