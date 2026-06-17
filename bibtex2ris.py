"""
BibTeX <-> RIS Converter — Scopus / Web of Science Standard
============================================================
Supports:
  • BibTeX  → RIS  (all standard fields, Scopus/WoS compatible)
  • RIS     → BibTeX (round-trip)

RIS tag reference
  https://en.wikipedia.org/wiki/RIS_(file_format)
  Scopus RIS export format  (checked against live Scopus exports)
  Web of Science RIS export format (ISI/WoS tagged-field reference)

Author: auto-generated
"""

from __future__ import annotations

import argparse
import re
import textwrap
import unicodedata
from pathlib import Path
from typing import Dict, List, Tuple

import bibtexparser
from bibtexparser.bparser import BibTexParser
from bibtexparser.customization import (
    convert_to_unicode,
    homogenize_latex_encoding,
)
from pylatexenc.latex2text import LatexNodes2Text
import rispy

# ---------------------------------------------------------------------------
# 1.  TYPE MAPS
# ---------------------------------------------------------------------------

BIBTEX_TO_RIS_TYPE: Dict[str, str] = {
    "article":        "JOUR",   # Journal article
    "book":           "BOOK",   # Book (whole)
    "booklet":        "PAMP",   # Pamphlet
    "inbook":         "CHAP",   # Book chapter
    "incollection":   "CHAP",   # Chapter in edited book
    "inproceedings":  "CPAPER", # Conference paper  (Scopus/WoS use CPAPER)
    "conference":     "CPAPER",
    "proceedings":    "CONF",   # Conference proceedings
    "phdthesis":      "THES",   # PhD thesis
    "mastersthesis":  "THES",   # Masters thesis
    "techreport":     "RPRT",   # Report
    "report":         "RPRT",
    "manual":         "MANSCPT",
    "misc":           "GEN",    # Generic
    "unpublished":    "UNPB",   # Unpublished
    "patent":         "PAT",    # Patent
    "electronic":     "ELEC",   # Web page / electronic resource
    "online":         "ELEC",
    "standard":       "STAND",  # Standard
    "dataset":        "DATA",   # Dataset
    "software":       "COMP",   # Software / computer program
    "map":            "MAP",
    "newspaper":      "NEWS",
    "magazine":       "MGZN",
}

FULL_MONTH_STRINGS: Dict[str, str] = {
    "january": "January",
    "february": "February",
    "march": "March",
    "april": "April",
    "may": "May",
    "june": "June",
    "july": "July",
    "august": "August",
    "sept": "September",
    "september": "September",
    "october": "October",
    "november": "November",
    "december": "December",
}

RIS_TO_BIBTEX_TYPE: Dict[str, str] = {
    "JOUR":    "article",
    "JFULL":   "article",
    "BOOK":    "book",
    "PAMP":    "booklet",
    "CHAP":    "inbook",
    "ECHAP":   "inbook",
    "CPAPER":  "inproceedings",
    "CONF":    "proceedings",
    "THES":    "phdthesis",
    "RPRT":    "techreport",
    "MANSCPT": "manual",
    "GEN":     "misc",
    "UNPB":    "unpublished",
    "PAT":     "patent",
    "ELEC":    "electronic",
    "STAND":   "standard",
    "DATA":    "dataset",
    "COMP":    "software",
    "MAP":     "map",
    "NEWS":    "newspaper",
    "MGZN":    "magazine",
    "ABST":    "article",
    "ADVS":    "misc",
    "ART":     "misc",
    "BILL":    "misc",
    "CASE":    "misc",
    "CLSWK":   "book",
    "CTLG":    "misc",
    "DICT":    "book",
    "EBOOK":   "book",
    "EDBOOK":  "book",
    "EJOUR":   "article",
    "ENCYC":   "book",
    "EQUA":    "misc",
    "FIGURE":  "misc",
    "GOVDOC":  "techreport",
    "GRANT":   "misc",
    "HEAR":    "misc",
    "ICOMM":   "misc",
    "INPR":    "unpublished",
    "LEGAL":   "misc",
    "MPCT":    "misc",
    "MULTI":   "misc",
    "MUSIC":   "misc",
    "PCOMM":   "misc",
    "SLIDE":   "misc",
    "SOUND":   "misc",
    "STAT":    "misc",
    "VIDEO":   "misc",
}

# ---------------------------------------------------------------------------
# 2.  FIELD MAPS  BibTeX -> RIS
# ---------------------------------------------------------------------------
# Each entry:  bibtex_field -> (ris_tag, transform_fn_or_None)
# Transform functions are defined below.

def _pages_to_ris(pages_str: str) -> List[Tuple[str, str]]:
    """Convert BibTeX pages field ('12--24') to [(SP, start), (EP, end)]."""
    clean = pages_str.replace("\u2013", "-").replace("\u2014", "-").replace("--", "-")
    parts = re.split(r"\s*-\s*", clean, maxsplit=1)
    result: List[Tuple[str, str]] = [("SP", parts[0].strip())]
    if len(parts) > 1 and parts[1].strip():
        result.append(("EP", parts[1].strip()))
    return result


def _author_to_ris(author_str: str) -> List[Tuple[str, str]]:
    """Split 'and'-separated author string into multiple AU tags."""
    authors = re.split(r"\s+and\s+", author_str, flags=re.IGNORECASE)
    return [("AU", a.strip()) for a in authors if a.strip()]


def _editor_to_ris(editor_str: str) -> List[Tuple[str, str]]:
    """Split 'and'-separated editor string into multiple ED tags."""
    editors = re.split(r"\s+and\s+", editor_str, flags=re.IGNORECASE)
    return [("ED", e.strip()) for e in editors if e.strip()]


def _keywords_to_ris(kw_str: str) -> List[Tuple[str, str]]:
    """Split comma/semicolon-separated keywords into multiple KW tags."""
    kws = re.split(r"[,;]", kw_str)
    return [("KW", k.strip()) for k in kws if k.strip()]


def _address_to_ris(addr: str) -> List[Tuple[str, str]]:
    """Map BibTeX address to RIS CY (city/place of publication)."""
    return [("CY", addr.strip())]


def _note_to_ris(note: str) -> List[Tuple[str, str]]:
    return [("N1", note.strip())]


def _annote_to_ris(annote: str) -> List[Tuple[str, str]]:
    return [("N2", annote.strip())]


def _normalize_month(month: str) -> str:
    """Best-effort normalize BibTeX month values to two digits."""
    month_map = {
        "jan": "01", "january": "01",
        "feb": "02", "february": "02",
        "mar": "03", "march": "03",
        "apr": "04", "april": "04",
        "may": "05",
        "jun": "06", "june": "06",
        "jul": "07", "july": "07",
        "aug": "08", "august": "08",
        "sep": "09", "sept": "09", "september": "09",
        "oct": "10", "october": "10",
        "nov": "11", "november": "11",
        "dec": "12", "december": "12",
    }
    cleaned = month.strip().lower().rstrip(".")
    if re.fullmatch(r"\d{1,2}", cleaned):
        month_number = int(cleaned)
        if 1 <= month_number <= 12:
            return f"{month_number:02d}"
    return month_map.get(cleaned, month.strip())


def _month_to_ris(month: str, year: str = "") -> List[Tuple[str, str]]:
    """Convert BibTeX month to RIS DA, including year when available."""
    normalized_month = _normalize_month(month)
    normalized_year = year.strip()
    if re.fullmatch(r"\d{4}", normalized_year) and re.fullmatch(r"\d{2}", normalized_month):
        return [("DA", f"{normalized_year}/{normalized_month}")]
    return [("DA", normalized_month)]


# Simple one-to-one field mappings  {bibtex_key: ris_tag}
SIMPLE_FIELD_MAP: Dict[str, str] = {
    "title":        "TI",   # Title
    "journal":      "JO",   # Journal name (full)
    "journaltitle": "JO",
    "booktitle":    "T2",   # Secondary title (book / proceedings title)
    "series":       "T3",   # Series title
    "chapter":      "SE",   # Chapter number / section
    "publisher":    "PB",   # Publisher
    "year":         "PY",   # Publication year
    "volume":       "VL",   # Volume
    "number":       "IS",   # Issue number
    "issue":        "IS",
    "doi":          "DO",   # DOI
    "url":          "UR",   # URL
    "abstract":     "AB",   # Abstract
    "issn":         "SN",   # ISSN
    "isbn":         "SN",   # ISBN (same RIS tag SN)
    "language":     "LA",   # Language
    "edition":      "ET",   # Edition
    "school":       "AD",   # Institution / school (thesis)
    "institution":  "AD",   # Institution (techreport)
    "organization": "AD",   # Organization
    "howpublished": "M3",   # Type of medium / how published
    "type":         "M3",   # Type descriptor
    "crossref":     "XR",   # Cross-reference key
    "copyright":    "C3",   # Copyright (Scopus uses C3 for this)
    "pmid":         "AN",   # PubMed ID  → Accession Number
    "eid":          "C7",   # Electronic identifier (Scopus EID / article number)
    "article-number": "C7",
    "archiveprefix": "DB",  # Database / archive (e.g. arXiv)
    "primaryclass": "C1",   # arXiv primary class → custom notes
    # "eprint" is intentionally omitted here — handled by the dedicated arXiv block
    "numpages":     "SP",   # Number of pages (alternative, used when no page range)
    "pagetotal":    "SP",
    "location":     "CY",   # Place of publication (BibLaTeX)
    "venue":        "CY",
}

# Fields with custom multi-value or transform logic
COMPLEX_FIELD_MAP = {
    "author":   _author_to_ris,
    "editor":   _editor_to_ris,
    "pages":    _pages_to_ris,
    "keywords": _keywords_to_ris,
    "address":  _address_to_ris,
    "note":     _note_to_ris,
    "annote":   _annote_to_ris,
    "month":    _month_to_ris,
}

# ---------------------------------------------------------------------------
# 3.  FIELD MAPS  RIS -> BibTeX
# ---------------------------------------------------------------------------

RIS_TO_BIBTEX_SIMPLE: Dict[str, str] = {
    "TI": "title",
    "T1": "title",
    "CT": "title",
    "BT": "booktitle",
    "T2": "booktitle",
    "T3": "series",
    "JO": "journal",
    "JF": "journal",
    "JA": "journal",
    "J1": "journal",
    "J2": "journal",
    "AB": "abstract",
    "PY": "year",
    "Y1": "year",
    "VL": "volume",
    "IS": "number",
    "CP": "number",
    "SE": "chapter",
    "PB": "publisher",
    "CY": "address",
    "AD": "institution",
    "DO": "doi",
    "UR": "url",
    "L1": "url",
    "L2": "url",
    "SN": "issn",
    "LA": "language",
    "ET": "edition",
    "DB": "archiveprefix",
    "M3": "type",
    "N1": "note",
    "N2": "annote",
    "SP": "pages",       # handled specially
    "EP": "pages",       # handled specially
    "DA": "month",
    "C7": "eid",
    "XR": "crossref",
    "C3": "copyright",
    "C1": "primaryclass",
}

# ---------------------------------------------------------------------------
# 4.  CORE CONVERTER  BibTeX -> RIS
# ---------------------------------------------------------------------------

LATEX_TO_TEXT = LatexNodes2Text()

def _clean_braces(value: str) -> str:
    """Convert LaTeX markup to Unicode/plain text and normalize whitespace."""
    if value is None:
        return ""

    text = str(value)

    try:
        text = LATEX_TO_TEXT.latex_to_text(text)
    except Exception:
        pass

    text = re.sub(r"[{}]", "", text)
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t\f\v ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def convert_entry_to_ris(entry: dict) -> str:
    """
    Convert a single bibtexparser entry dict to a RIS-formatted string
    compatible with Scopus and Web of Science.
    """
    ris: List[str] = []

    # --- TY (type) ---------------------------------------------------------
    bib_type = entry.get("ENTRYTYPE", "misc").lower()
    ris_type = BIBTEX_TO_RIS_TYPE.get(bib_type, "GEN")
    ris.append(f"TY  - {ris_type}")

    # --- ID / AN (citekey → accession number) ------------------------------
    cite_key = entry.get("ID", "")
    ris.append(f"ID  - {cite_key}")
    # Only write AN if pmid not present (pmid overwrites AN later)
    if "pmid" not in entry:
        ris.append(f"AN  - {cite_key}")

    # --- Thesis subtype annotation -----------------------------------------
    if bib_type == "mastersthesis":
        ris.append("M3  - Masters Thesis")
    elif bib_type == "phdthesis":
        ris.append("M3  - PhD Thesis")

    # --- Complex multi-value fields first (author, editor, keywords, etc.) --
    for bib_field, transform_fn in COMPLEX_FIELD_MAP.items():
        if bib_field in entry:
            raw = _clean_braces(entry[bib_field])
            ris_values = _month_to_ris(raw, _clean_braces(entry.get("year", ""))) if bib_field == "month" else transform_fn(raw)
            for tag, val in ris_values:
                ris.append(f"{tag}  - {val}")

    # --- Simple one-to-one fields ------------------------------------------
    seen_tags = set()
    for bib_field, ris_tag in SIMPLE_FIELD_MAP.items():
        if bib_field in entry:
            # Skip duplicate ris_tag (e.g. issn and isbn both map to SN)
            if ris_tag in seen_tags:
                continue
            seen_tags.add(ris_tag)
            val = _clean_braces(entry[bib_field])
            if val:
                ris.append(f"{ris_tag}  - {val}")

    # --- arXiv special: build URL from eprint if no url --------------------
    if "eprint" in entry:
        prefix = entry.get("archiveprefix", "arXiv").lower()
        eprint_id = _clean_braces(entry["eprint"])
        if "arxiv" in prefix:
            if "url" not in entry:
                ris.append(f"UR  - https://arxiv.org/abs/{eprint_id}")
        else:
            # Non-arXiv eprint: store raw id as note
            ris.append(f"N1  - eprint: {eprint_id}")

    # --- Catch-all: any remaining unmapped BibTeX fields → N1 notes --------
    mapped_bibtex = (
        set(COMPLEX_FIELD_MAP.keys())
        | set(SIMPLE_FIELD_MAP.keys())
        | {"ENTRYTYPE", "ID", "pmid", "eprint", "archiveprefix"}
    )
    for bib_field, raw_val in entry.items():
        if bib_field not in mapped_bibtex and not bib_field.startswith("_"):
            val = _clean_braces(str(raw_val))
            if val:
                ris.append(f"N1  - {bib_field}: {val}")

    # --- ER (end of record) ------------------------------------------------
    ris.append("ER  -")
    return "\n".join(ris)


# ---------------------------------------------------------------------------
# 5.  CORE CONVERTER  RIS -> BibTeX
# ---------------------------------------------------------------------------

def convert_ris_entry_to_bibtex(ris_entry: dict) -> str:
    """
    Convert a single rispy entry dict to a BibTeX-formatted string.
    """
    ris_type = ris_entry.get("type_of_reference", "GEN")
    bib_type = RIS_TO_BIBTEX_TYPE.get(ris_type, "misc")

    # Collect fields
    fields: Dict[str, str] = {}

    # Authors
    authors = ris_entry.get("authors", [])
    if authors:
        fields["author"] = " and ".join(authors)

    # Editors
    editors = ris_entry.get("first_authors", [])   # rispy quirk
    if not editors:
        editors = ris_entry.get("editors", [])
    if editors:
        fields["editor"] = " and ".join(editors)

    # Keywords
    kws = ris_entry.get("keywords", [])
    if kws:
        fields["keywords"] = ", ".join(kws)

    # Pages: SP + EP → pages
    sp = ris_entry.get("start_page", "")
    ep = ris_entry.get("end_page", "")
    if sp and ep:
        fields["pages"] = f"{sp}--{ep}"
    elif sp:
        fields["pages"] = sp

    # Simple mappings
    for ris_tag, bib_field in RIS_TO_BIBTEX_SIMPLE.items():
        # rispy uses lowercase snake_case keys derived from tag names
        # We'll probe both the raw tag and common rispy key names
        rispy_key = _ris_tag_to_rispy_key(ris_tag)
        val = ris_entry.get(rispy_key) or ris_entry.get(ris_tag)
        if val and bib_field not in fields:
            if isinstance(val, list):
                val = ", ".join(str(v) for v in val)
            val = str(val).strip()
            if val:
                fields[bib_field] = val

    # Cite key
    cite_key = (
        ris_entry.get("id")
        or ris_entry.get("accession_number")
        or ris_entry.get("AN")
        or _generate_cite_key(fields)
    )
    cite_key = re.sub(r"[^A-Za-z0-9_:\-]", "_", cite_key)

    # Build BibTeX string
    lines = [f"@{bib_type}{{{cite_key},"]
    for k, v in fields.items():
        if v:
            lines.append(f"  {k} = {{{v}}},")
    lines.append("}")
    return "\n".join(lines)


def _ris_tag_to_rispy_key(tag: str) -> str:
    """Map a 2-letter RIS tag to the likely rispy dict key."""
    _TAG_TO_RISPY = {
        "TI": "title", "T1": "title", "CT": "title",
        "T2": "secondary_title", "BT": "secondary_title",
        "T3": "tertiary_title",
        "JO": "journal_name", "JF": "journal_name",
        "JA": "alternate_title1", "J1": "alternate_title2", "J2": "alternate_title3",
        "AB": "abstract", "PY": "year", "Y1": "year",
        "VL": "volume", "IS": "number", "CP": "issue",
        "SE": "section", "PB": "publisher",
        "CY": "place_published", "AD": "author_address",
        "DO": "doi", "UR": "url", "L1": "file_attachments1", "L2": "file_attachments2",
        "SN": "issn", "LA": "language", "ET": "edition",
        "DB": "name_of_database", "M3": "type_of_work",
        "N1": "notes", "N2": "notes_abstract",
        "SP": "start_page", "EP": "end_page",
        "DA": "date",
        "C7": "notes_abstract", "XR": "related_records",
        "AN": "accession_number", "ID": "id",
    }
    return _TAG_TO_RISPY.get(tag, tag.lower())


def _generate_cite_key(fields: dict) -> str:
    """Generate a fallback cite key from author + year."""
    author = fields.get("author", "")
    year = fields.get("year", "0000")
    first_author = author.split(" and ")[0].split(",")[0].strip() if author else "Unknown"
    first_author = re.sub(r"\s+", "", first_author)
    return f"{first_author}{year}"


# ---------------------------------------------------------------------------
# 6.  FILE-LEVEL CONVERTERS
# ---------------------------------------------------------------------------

def bibtex_to_ris(input_bib: str | Path, output_ris: str | Path) -> int:
    """
    Convert a BibTeX file to RIS format (Scopus / WoS compatible).
    Returns the number of entries converted.
    """
    input_bib = Path(input_bib)
    output_ris = Path(output_ris)

    parser = BibTexParser(common_strings=True)
    parser.bib_database.strings.update(FULL_MONTH_STRINGS)
    parser.customization = lambda rec: homogenize_latex_encoding(convert_to_unicode(rec))
    parser.ignore_nonstandard_types = False

    with input_bib.open(encoding="utf-8", errors="replace") as fh:
        bib_db = bibtexparser.load(fh, parser=parser)

    count = 0
    with output_ris.open("w", encoding="utf-8") as fh:
        for entry in bib_db.entries:
            fh.write(convert_entry_to_ris(entry))
            fh.write("\n\n")
            count += 1

    return count


def ris_to_bibtex(input_ris: str | Path, output_bib: str | Path) -> int:
    """
    Convert a RIS file to BibTeX format.
    Returns the number of entries converted.
    """
    input_ris = Path(input_ris)
    output_bib = Path(output_bib)

    with input_ris.open(encoding="utf-8", errors="replace") as fh:
        entries = rispy.load(fh)

    count = 0
    with output_bib.open("w", encoding="utf-8") as fh:
        for entry in entries:
            fh.write(convert_ris_entry_to_bibtex(entry))
            fh.write("\n\n")
            count += 1

    return count


# ---------------------------------------------------------------------------
# 7.  CLI
# ---------------------------------------------------------------------------

def _build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="bibtex2ris",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=textwrap.dedent("""\
            BibTeX <-> RIS Converter  (Scopus / Web of Science standard)
            ─────────────────────────────────────────────────────────────
            Examples:
              python bibtex2ris.py bib2ris references.bib references.ris
              python bibtex2ris.py ris2bib scopus_export.ris output.bib
        """),
    )
    sub = p.add_subparsers(dest="command", required=True)

    # bib2ris
    p1 = sub.add_parser("bib2ris", help="Convert BibTeX → RIS")
    p1.add_argument("input",  help="Input .bib file")
    p1.add_argument("output", help="Output .ris file")

    # ris2bib
    p2 = sub.add_parser("ris2bib", help="Convert RIS → BibTeX")
    p2.add_argument("input",  help="Input .ris file")
    p2.add_argument("output", help="Output .bib file")

    return p


def main() -> None:
    args = _build_argparser().parse_args()

    if args.command == "bib2ris":
        n = bibtex_to_ris(args.input, args.output)
        print(f"[OK] Converted {n} BibTeX entries → {args.output}")
    elif args.command == "ris2bib":
        n = ris_to_bibtex(args.input, args.output)
        print(f"[OK] Converted {n} RIS entries → {args.output}")


if __name__ == "__main__":
    main()

