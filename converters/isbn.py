from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class ISBNConversionResult:
    output_text: str
    success_count: int
    total_count: int
    input_count: int
    failed_lines: List[str]
    duplicate_lines: List[str]


def _is_valid_isbn(value: str) -> bool:
    """Check if string looks like a valid ISBN."""
    clean = value.replace("-", "").replace(" ", "")
    if len(clean) == 10:
        return re.match(r"^\d{9}[\dX]$", clean, re.IGNORECASE) is not None
    elif len(clean) == 13:
        return re.match(r"^\d{13}$", clean) is not None
    return False


def normalize_isbn(raw: str) -> str:
    """Normalize and validate ISBN from raw input."""
    value = raw.strip()
    if not value:
        return ""

    value = re.sub(r"^isbn\s*:?\s*", "", value, flags=re.IGNORECASE)
    value = value.strip()

    if not _is_valid_isbn(value):
        raise ValueError(f"Định dạng ISBN không hợp lệ: {raw}")

    clean = value.replace("-", "").replace(" ", "").upper()
    return clean


def extract_isbns_from_lines(text: str) -> tuple[List[str], List[str], List[str], int]:
    """Extract unique ISBNs from lines, tracking invalid and duplicate inputs."""
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
            isbn = normalize_isbn(line)
            if isbn in seen:
                duplicates.append(f"Dòng {idx}: {line.strip()} -> {isbn}")
                continue
            seen.add(isbn)
            valid.append(isbn)
        except ValueError as exc:
            failed.append(f"Dòng {idx}: {line.strip()} ({exc})")

    return valid, failed, duplicates, input_count


def fetch_isbn_bibtex_batch(isbns: List[str]) -> str:
    """Fetch BibTeX for ISBNs using Paperpile API."""
    if not isbns:
        raise ValueError("Không có ISBN để truy xuất")

    isbn_input = "\n".join(isbns)
    payload = {
        "fromIds": True,
        "input": isbn_input,
        "targetFormat": "Bibtex"
    }

    req = Request(
        "https://api.paperpile.com/api/public/convert",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "bibtex2ris-web/1.0",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(req, timeout=30) as response:
            response_data = json.loads(response.read().decode("utf-8"))
            if "output" not in response_data:
                raise ValueError("Phản hồi Paperpile không có đầu ra")

            output = response_data.get("output", "").strip()
            if not output:
                raise ValueError("Paperpile trả về đầu ra rỗng")

            return output
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip() or exc.reason
        raise ValueError(f"Lỗi API Paperpile ({exc.code}): {detail}") from exc
    except URLError as exc:
        raise ValueError(f"Không thể kết nối tới API Paperpile: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Phản hồi JSON từ API Paperpile không hợp lệ: {exc}") from exc


def convert_isbn_lines(text: str) -> ISBNConversionResult:
    """Convert one ISBN per line to BibTeX using Paperpile API."""
    valid_isbns, failed_lines, duplicate_lines, input_count = extract_isbns_from_lines(text)

    if not valid_isbns and failed_lines:
        raise ValueError("Không tìm thấy ISBN hợp lệ. Vui lòng nhập mỗi dòng một ISBN.")
    if not valid_isbns:
        raise ValueError("Chưa có ISBN. Vui lòng nhập mỗi dòng một ISBN.")

    try:
        bibtex_output = fetch_isbn_bibtex_batch(valid_isbns)
    except Exception as exc:
        if not valid_isbns:
            raise ValueError(f"Không thể lấy BibTeX cho bất kỳ ISBN nào: {exc}") from exc
        for isbn in valid_isbns:
            failed_lines.append(f"ISBN {isbn}: lỗi API Paperpile")
        raise ValueError("Không thể lấy siêu dữ liệu cho bất kỳ ISBN nào từ dịch vụ.") from exc

    entries = _parse_bibtex_entries(bibtex_output)

    if not entries:
        raise ValueError("API Paperpile không trả về mục BibTeX nào.")

    output_text = "\n\n".join(entries).strip()
    if output_text:
        output_text += "\n"

    return ISBNConversionResult(
        output_text=output_text,
        success_count=len(entries),
        total_count=len(valid_isbns),
        input_count=input_count,
        failed_lines=failed_lines,
        duplicate_lines=duplicate_lines,
    )


def _parse_bibtex_entries(bibtex_text: str) -> List[str]:
    """Split Paperpile BibTeX output into individual formatted entries."""
    entries = []
    current_entry: List[str] = []
    brace_depth = 0

    for line in bibtex_text.split("\n"):
        if not current_entry and not line.strip().startswith("@"):
            continue

        current_entry.append(line)
        brace_depth += line.count("{") - line.count("}")

        if brace_depth == 0 and current_entry and any(c in "".join(current_entry) for c in "{}"):
            entry_text = "\n".join(current_entry).strip()
            if entry_text.startswith("@"):
                entries.append(entry_text)
            current_entry = []

    return entries




