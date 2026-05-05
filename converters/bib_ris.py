from __future__ import annotations

import os
import tempfile

from bibtex2ris import bibtex_to_ris, ris_to_bibtex


VALID_BIB_RIS_TYPES = {"bib2ris", "ris2bib"}


def convert_bib_ris_text(conversion_type: str, source_text: str) -> tuple[str, int]:
    """Convert plain text between BibTeX and RIS using the file-level converter."""
    if conversion_type not in VALID_BIB_RIS_TYPES:
        raise ValueError(f"Kiểu chuyển đổi không được hỗ trợ: {conversion_type}")

    infile_path = ""
    outfile_path = ""

    try:
        suffix = ".bib" if conversion_type == "bib2ris" else ".ris"
        with tempfile.NamedTemporaryFile(mode="w+", delete=False, suffix=suffix, encoding="utf-8") as infile:
            infile.write(source_text)
            infile_path = infile.name

        out_suffix = ".ris" if conversion_type == "bib2ris" else ".bib"
        with tempfile.NamedTemporaryFile(mode="w+", delete=False, suffix=out_suffix, encoding="utf-8") as outfile:
            outfile_path = outfile.name

        if conversion_type == "bib2ris":
            count = bibtex_to_ris(infile_path, outfile_path)
        else:
            count = ris_to_bibtex(infile_path, outfile_path)

        with open(outfile_path, "r", encoding="utf-8") as fh:
            output_text = fh.read()

        return output_text, count
    finally:
        if infile_path and os.path.exists(infile_path):
            os.remove(infile_path)
        if outfile_path and os.path.exists(outfile_path):
            os.remove(outfile_path)

