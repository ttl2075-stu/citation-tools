# BibTeX / RIS / DOI / ISBN Converter

A small Flask web application for converting academic reference formats and managing a browser-local BibTeX collection.

## Demo

Published demo: <https://bib2ris.long.pro.vn>

## Features

- Convert `BibTeX -> RIS`
- Convert `RIS -> BibTeX`
- Convert DOI lists to BibTeX
- Convert ISBN lists to BibTeX
- Store generated BibTeX entries in the browser with `localStorage`
- Edit citation keys before saving entries
- Format and check BibTeX collections with `bibtex-tidy`

## Requirements

- Python 3.11+
- Node.js 18+
- npm

Node.js is required because the BibTeX repository cleanup endpoint uses the `bibtex-tidy` npm package.

## Local Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
npm install
python app.py
```

Open `http://127.0.0.1:5000`.

## Docker

Build and run the app with Docker Compose:

```powershell
docker compose up -d --build
```

The compose file maps the app to `http://127.0.0.1:5862`.

## API Endpoints

Each conversion endpoint accepts either form field `input_text` or uploaded file field `file_input`.

- `POST /api/bibtex-to-ris`
- `POST /api/ris-to-bibtex`
- `POST /api/doi-to-bibtex`
- `POST /api/isbn-to-bibtex`

The BibTeX cleanup endpoint accepts JSON:

```json
{
  "bibtex": "@article{key,title={Example}}",
  "options": {
    "duplicates": ["doi", "key", "citation"],
    "sort": true,
    "sortFields": true
  }
}
```

- `POST /api/bibtex-tidy`

The legacy `POST /convert` route remains available for older clients.

## CLI Usage

The converter can also be used from the command line:

```powershell
python bibtex2ris.py bib2ris sample.bib sample.ris
python bibtex2ris.py ris2bib sample.ris sample.bib
```

## Smoke Test

After installing Python and Node dependencies:

```powershell
python smoke_test.py
```

The smoke test covers the conversion helpers and Flask endpoints, including the `bibtex-tidy` integration.

## Project Structure

- `app.py`: Flask routes and request dispatch
- `bibtex2ris.py`: CLI converter
- `converters/`: conversion services for BibTeX, RIS, DOI, and ISBN
- `scripts/bibtex_tidy.js`: Node.js wrapper around `bibtex-tidy`
- `templates/index.html`: web UI
- `static/css/app.css`: UI styles
- `static/js/app.js`: browser behavior and endpoint calls
- `Dockerfile`: container image for Python + Node runtime
- `docker-compose.yml`: local container runner

## Notes

- Text output is UTF-8.
- DOI and ISBN conversion depend on external metadata services.
- The browser BibTeX repository is stored locally in `localStorage`; it is not saved on the server.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
