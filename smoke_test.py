from __future__ import annotations

import os
import tempfile
from pathlib import Path

from app import app as flask_app
from bibtex2ris import bibtex_to_ris
from converters import doi as doi_converter
from converters.doi import convert_doi_lines, format_bibtex_entry
from converters import isbn as isbn_converter
from converters.isbn import convert_isbn_lines


def test_bibtex_to_ris_latex() -> None:
    sample = r'''@article{mueller2024,
  author = {M{\"u}ller, J{\"o}rg and Fran{\c c}ois, Ren{\'e}},
  title = {An {\LaTeX} study of {\alpha}--{\beta} and A\&B},
  journal = {Journal of {\textendash} Symbols},
  abstract = {Testing {\%} markup and {\aa} accents.},
  pages = {12--24},
  year = {2024}
}'''

    with tempfile.TemporaryDirectory() as td:
        inp = Path(td) / "sample.bib"
        out = Path(td) / "sample.ris"
        inp.write_text(sample, encoding="utf-8")
        count = bibtex_to_ris(inp, out)
        content = out.read_text(encoding="utf-8")

    assert count == 1
    assert ("Muller" in content) or ("Müller" in content)
    assert "A&B" in content
    assert "TY  - JOUR" in content


def test_bibtex_month_to_ris_date() -> None:
    sample = """@article{monthdemo,
  title = {Month Demo},
  author = {Doe, Jane},
  month = {may},
  year = {2026}
}"""

    with tempfile.TemporaryDirectory() as td:
        inp = Path(td) / "sample.bib"
        out = Path(td) / "sample.ris"
        inp.write_text(sample, encoding="utf-8")
        count = bibtex_to_ris(inp, out)
        content = out.read_text(encoding="utf-8")

    assert count == 1
    assert "PY  - 2026" in content
    assert "DA  - 2026/05" in content


def test_bibtex_full_month_string_to_ris_date() -> None:
    month_cases = {
        "january": "01",
        "february": "02",
        "march": "03",
        "april": "04",
        "may": "05",
        "june": "06",
        "july": "07",
        "august": "08",
        "sept": "09",
        "september": "09",
        "october": "10",
        "november": "11",
        "december": "12",
    }

    with tempfile.TemporaryDirectory() as td:
        for month_name, month_number in month_cases.items():
            sample = f"""@article{{monthdemo,
  title = {{Month Demo}},
  author = {{Doe, Jane}},
  month = {month_name},
  year = {{2026}}
}}"""
            inp = Path(td) / f"{month_name}.bib"
            out = Path(td) / f"{month_name}.ris"
            inp.write_text(sample, encoding="utf-8")
            count = bibtex_to_ris(inp, out)
            content = out.read_text(encoding="utf-8")

            assert count == 1
            assert "PY  - 2026" in content
            assert f"DA  - 2026/{month_number}" in content


def test_doi_bibtex_service() -> None:
    source = "\n".join(
        [
            "10.1145/2783446.2783605",
            "https://doi.org/10.1145/2783446.2783605",
            "http://dx.doi.org/10.1145/2783446.2783605",
        ]
    )
    result = convert_doi_lines(source, style="bibtex", lang="en-US")
    assert result.success_count >= 1
    assert "@" in result.output_text


def test_doi_formatting_and_duplicates() -> None:
    raw_entry = "@article{demo,author={Doe, Jane},title={Sample Title},year={2026}}"
    formatted = format_bibtex_entry(raw_entry)
    assert formatted.startswith("@article{demo,")
    assert "\n  author = {Doe, Jane}," in formatted
    assert formatted.endswith("\n}")

    original_fetch = doi_converter.fetch_doi_bibtex
    try:
        doi_converter.fetch_doi_bibtex = lambda doi: raw_entry
        result = convert_doi_lines(
            "\n".join(
                [
                    "10.1000/demo",
                    "https://doi.org/10.1000/demo",
                    "http://dx.doi.org/10.1000/demo",
                ]
            ),
            style="bibtex",
            lang="en-US",
        )
    finally:
        doi_converter.fetch_doi_bibtex = original_fetch

    assert result.success_count == 1
    assert result.total_count == 1
    assert result.input_count == 3
    assert len(result.duplicate_lines) == 2
    assert result.output_text.count("@article") == 1


def test_doi_requested_key() -> None:
    raw_entry = "@article{serviceKey,author={Doe, Jane},title={Sample Title},year={2026}}"
    original_fetch = doi_converter.fetch_doi_bibtex
    try:
        doi_converter.fetch_doi_bibtex = lambda doi: raw_entry
        result = convert_doi_lines("{customDoiKey}10.1000/demo", style="bibtex", lang="en-US")
    finally:
        doi_converter.fetch_doi_bibtex = original_fetch

    assert result.citation_keys == ["customDoiKey"]
    assert "@article{customDoiKey," in result.output_text


def test_isbn_duplicates() -> None:
    """Test ISBN normalization and duplicate skipping using Paperpile API."""
    original_fetch = isbn_converter.fetch_isbn_bibtex_batch
    try:
        # Mock Paperpile API response
        isbn_converter.fetch_isbn_bibtex_batch = lambda isbns: (
            '@BOOK{key,\n'
            '  author = {Author},\n'
            '  title = {Book},\n'
            '  year = {2024}\n'
            '}\n'
        )
        result = convert_isbn_lines(
            "\n".join(
                [
                    "978-0-446-31078-9",
                    "9780446310789",
                    "978 0 446 31078 9",
                ]
            )
        )
    finally:
        isbn_converter.fetch_isbn_bibtex_batch = original_fetch

    assert result.success_count == 1
    assert result.total_count == 1
    assert result.input_count == 3
    assert len(result.duplicate_lines) == 2
    assert "@BOOK{key," in result.output_text


def test_isbn_requested_key() -> None:
    original_fetch = isbn_converter.fetch_isbn_bibtex_batch
    try:
        isbn_converter.fetch_isbn_bibtex_batch = lambda isbns: (
            "@BOOK{serviceKey,\n"
            "  title = {Book},\n"
            "  year = {2024}\n"
            "}\n"
        )
        result = convert_isbn_lines("{customIsbnKey}978-0-446-31078-9")
    finally:
        isbn_converter.fetch_isbn_bibtex_batch = original_fetch

    assert result.citation_keys == ["customIsbnKey"]
    assert "@BOOK{customIsbnKey," in result.output_text


def test_separate_api_endpoints() -> None:
    original_doi_fetch = doi_converter.fetch_doi_bibtex
    original_isbn_fetch = isbn_converter.fetch_isbn_bibtex_batch
    try:
        doi_converter.fetch_doi_bibtex = lambda doi: "@article{doiKey,title={DOI Title},year={2026}}"
        isbn_converter.fetch_isbn_bibtex_batch = lambda isbns: (
            "@BOOK{isbnKey,\n"
            "  title = {ISBN Title},\n"
            "  year = {2026}\n"
            "}\n"
        )

        client = flask_app.test_client()

        bib_response = client.post(
            "/api/bibtex-to-ris",
            data={"input_text": "@article{demo,title={Demo},year={2026}}"},
        )
        assert bib_response.status_code == 200
        assert "TY  -" in bib_response.get_json()["output_text"]

        ris_response = client.post(
            "/api/ris-to-bibtex",
            data={"input_text": "TY  - JOUR\nTI  - Demo\nPY  - 2026\nER  -\n"},
        )
        assert ris_response.status_code == 200
        assert "@" in ris_response.get_json()["output_text"]

        doi_response = client.post("/api/doi-to-bibtex", data={"input_text": "10.1000/demo"})
        assert doi_response.status_code == 200
        assert "@article{doiKey," in doi_response.get_json()["output_text"]

        keyed_doi_response = client.post("/api/doi-to-bibtex", data={"input_text": "{myDoi}10.1000/demo"})
        assert keyed_doi_response.status_code == 200
        keyed_doi_payload = keyed_doi_response.get_json()
        assert "@article{myDoi," in keyed_doi_payload["output_text"]
        assert keyed_doi_payload["citation_keys"] == ["myDoi"]

        isbn_response = client.post("/api/isbn-to-bibtex", data={"input_text": "978-0-446-31078-9"})
        assert isbn_response.status_code == 200
        assert "@BOOK{isbnKey," in isbn_response.get_json()["output_text"]

        keyed_isbn_response = client.post("/api/isbn-to-bibtex", data={"input_text": "{myIsbn}978-0-446-31078-9"})
        assert keyed_isbn_response.status_code == 200
        keyed_isbn_payload = keyed_isbn_response.get_json()
        assert "@BOOK{myIsbn," in keyed_isbn_payload["output_text"]
        assert keyed_isbn_payload["citation_keys"] == ["myIsbn"]

        tidy_response = client.post(
            "/api/bibtex-tidy",
            json={
                "bibtex": (
                    "@article{a,title={T},author={Doe},doi={10.1/x}}\n"
                    "@article{b,title={T},author={Doe},doi={10.1/x}}"
                ),
                "options": {"duplicates": ["doi", "key", "citation"], "sort": True, "sortFields": True},
            },
        )
        assert tidy_response.status_code == 200
        tidy_payload = tidy_response.get_json()
        assert tidy_payload["count"] == 2
        assert any(warning.get("rule") == "doi" for warning in tidy_payload["warnings"])
        assert "title" in tidy_payload["bibtex"]
    finally:
        doi_converter.fetch_doi_bibtex = original_doi_fetch
        isbn_converter.fetch_isbn_bibtex_batch = original_isbn_fetch


def test_ai_bibtex_endpoint_requires_configuration() -> None:
    original_api_key = os.environ.pop("OPENAI_API_KEY", None)
    client = flask_app.test_client()
    try:
        response = client.post("/api/ai-bibtex", json={"source_text": "Title: Demo Article"})
        assert response.status_code == 500
        assert "OPENAI_API_KEY" in response.get_json()["error"]
    finally:
        if original_api_key is not None:
            os.environ["OPENAI_API_KEY"] = original_api_key


if __name__ == "__main__":
    test_bibtex_to_ris_latex()
    test_bibtex_month_to_ris_date()
    test_bibtex_full_month_string_to_ris_date()
    test_doi_formatting_and_duplicates()
    test_doi_requested_key()
    test_isbn_duplicates()
    test_isbn_requested_key()
    test_separate_api_endpoints()
    test_ai_bibtex_endpoint_requires_configuration()

    try:
        test_doi_bibtex_service()
        print("[OK] smoke tests passed (bibtex + doi + isbn)")
    except Exception as exc:
        print(f"[WARN] DOI smoke test skipped/failed: {exc}")
        print("[OK] bibtex smoke test passed")




