import io
import json
import os
import subprocess
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_file

from converters.bib_ris import convert_bib_ris_text
from converters.common import decode_uploaded_text
from converters.doi import convert_doi_lines
from converters.isbn import convert_isbn_lines

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent


def get_asset_version():
    configured_version = os.getenv('ASSET_VERSION')
    if configured_version:
        return configured_version

    asset_paths = [
        BASE_DIR / 'static' / 'css' / 'app.css',
        BASE_DIR / 'static' / 'js' / 'app.js',
    ]
    latest_mtime = max(path.stat().st_mtime for path in asset_paths if path.exists())
    return str(int(latest_mtime))


ASSET_VERSION = get_asset_version()
OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'


def get_source_text():
    input_text = request.form.get('input_text') or ''
    input_file = request.files.get('file_input')

    if input_file and input_file.filename:
        return decode_uploaded_text(input_file)
    return input_text


def conversion_response(result, source_text):
    payload = {
        'output_text': result.output_text,
        'count': result.success_count,
        'total': result.total_count,
        'input_count': result.input_count,
        'failed_lines': result.failed_lines,
        'duplicate_lines': result.duplicate_lines,
        'input_text': source_text,
    }
    citation_keys = getattr(result, 'citation_keys', None)
    if citation_keys is not None:
        payload['citation_keys'] = citation_keys
    return jsonify(payload)


def convert_bibtex_to_ris(source_text):
    if not source_text.strip():
        return jsonify({'error': 'Chưa có dữ liệu đầu vào. Vui lòng dán văn bản hoặc tải tệp lên.'}), 400

    try:
        output_text, count = convert_bib_ris_text('bib2ris', source_text)
        return jsonify({
            'output_text': output_text,
            'count': count,
            'input_text': source_text,
        })
    except Exception as e:
        error_message = f"Đã xảy ra lỗi trong quá trình chuyển đổi: {str(e)}"
        return jsonify({'error': error_message, 'input_text': source_text}), 500


def convert_ris_to_bibtex(source_text):
    if not source_text.strip():
        return jsonify({'error': 'Chưa có dữ liệu đầu vào. Vui lòng dán văn bản hoặc tải tệp lên.'}), 400

    try:
        output_text, count = convert_bib_ris_text('ris2bib', source_text)
        return jsonify({
            'output_text': output_text,
            'count': count,
            'input_text': source_text,
        })
    except Exception as e:
        error_message = f"Đã xảy ra lỗi trong quá trình chuyển đổi: {str(e)}"
        return jsonify({'error': error_message, 'input_text': source_text}), 500


def convert_doi_to_bibtex(source_text):
    if not source_text.strip():
        return jsonify({'error': 'Chưa có DOI. Vui lòng nhập mỗi dòng một DOI.'}), 400

    try:
        result = convert_doi_lines(source_text, style='bibtex', lang='en-US')
        return conversion_response(result, source_text)
    except Exception as e:
        error_message = f"Đã xảy ra lỗi trong quá trình chuyển đổi: {str(e)}"
        return jsonify({'error': error_message, 'input_text': source_text}), 500


def convert_isbn_to_bibtex(source_text):
    if not source_text.strip():
        return jsonify({'error': 'Chưa có ISBN. Vui lòng nhập mỗi dòng một ISBN.'}), 400

    try:
        result = convert_isbn_lines(source_text)
        return conversion_response(result, source_text)
    except Exception as e:
        error_message = f"Đã xảy ra lỗi trong quá trình chuyển đổi: {str(e)}"
        return jsonify({'error': error_message, 'input_text': source_text}), 500


def run_bibtex_tidy(bibtex_text, options):
    script_path = BASE_DIR / 'scripts' / 'bibtex_tidy.js'
    payload = json.dumps({'bibtex': bibtex_text, 'options': options or {}})

    completed = subprocess.run(
        ['node', str(script_path)],
        input=payload,
        text=True,
        capture_output=True,
        timeout=20,
        cwd=BASE_DIR,
        check=False,
    )

    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or 'bibtex-tidy chạy không thành công'
        raise RuntimeError(detail)

    return json.loads(completed.stdout)


def extract_openai_text(payload):
    output_text = payload.get('output_text')
    if output_text:
        return str(output_text).strip()

    chunks = []
    for item in payload.get('output', []):
        for content in item.get('content', []):
            if content.get('type') in ('output_text', 'text') and content.get('text'):
                chunks.append(str(content.get('text')))
    return ''.join(chunks).strip()


def generate_bibtex_with_openai(source_text):
    api_key = os.getenv('OPENAI_API_KEY') or ""
    if not api_key:
        raise RuntimeError('Chưa cấu hình OPENAI_API_KEY trên server.')

    model = os.getenv('OPENAI_MODEL', 'gpt-5.4-mini')
    prompt = (
        'Hãy tạo đúng một mục BibTeX từ thông tin dưới đây. '
        'Chỉ trả về mã BibTeX thuần, không dùng Markdown, không giải thích. '
        'Nếu thiếu DOI/ISBN thì vẫn tạo BibTeX phù hợp bằng các trường có sẵn. '
        'Ưu tiên entry type @article, @inproceedings, @book, @phdthesis hoặc @misc theo ngữ cảnh. '
        'Không tự bịa thông tin không có trong đầu vào; bỏ qua trường chưa chắc chắn.\n\n'
        f'Thông tin nguồn:\n{source_text.strip()}'
    )
    body = {
        'model': model,
        'instructions': (
            'Bạn là trợ lý biên mục học thuật. Nhiệm vụ duy nhất là soạn BibTeX hợp lệ, '
            'dùng dấu ngoặc nhọn, trường lowercase, và giữ nguyên tên riêng nếu có.'
        ),
        'input': prompt,
        'max_output_tokens': 1200,
    }
    request_obj = Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    try:
        with urlopen(request_obj, timeout=30) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'OpenAI API trả về lỗi HTTP {exc.code}: {detail[:500]}') from exc
    except URLError as exc:
        raise RuntimeError(f'Không thể kết nối OpenAI API: {exc.reason}') from exc

    bibtex = extract_openai_text(payload)
    if not bibtex:
        raise RuntimeError('OpenAI API không trả về nội dung BibTeX.')
    return bibtex


@app.route('/')
def index():
    return render_template('index.html', asset_version=ASSET_VERSION)


@app.route('/api/bibtex-to-ris', methods=['POST'])
def api_bibtex_to_ris():
    return convert_bibtex_to_ris(get_source_text())


@app.route('/api/ris-to-bibtex', methods=['POST'])
def api_ris_to_bibtex():
    return convert_ris_to_bibtex(get_source_text())


@app.route('/api/doi-to-bibtex', methods=['POST'])
def api_doi_to_bibtex():
    return convert_doi_to_bibtex(get_source_text())


@app.route('/api/isbn-to-bibtex', methods=['POST'])
def api_isbn_to_bibtex():
    return convert_isbn_to_bibtex(get_source_text())


@app.route('/api/bibtex-tidy', methods=['POST'])
def api_bibtex_tidy():
    payload = request.get_json(silent=True) or {}
    bibtex_text = payload.get('bibtex') or ''
    options = payload.get('options') or {}

    if not bibtex_text.strip():
        return jsonify({'error': 'Chưa có BibTeX.'}), 400

    try:
        return jsonify(run_bibtex_tidy(bibtex_text, options))
    except Exception as e:
        return jsonify({'error': f'Lỗi bibtex-tidy: {str(e)}'}), 500


@app.route('/api/ai-bibtex', methods=['POST'])
def api_ai_bibtex():
    payload = request.get_json(silent=True) or {}
    source_text = payload.get('source_text') or ''

    if not source_text.strip():
        return jsonify({'error': 'Vui lòng nhập thông tin bài viết để AI soạn BibTeX.'}), 400

    try:
        bibtex = generate_bibtex_with_openai(source_text)
        return jsonify({'bibtex': bibtex, 'output_text': bibtex})
    except Exception as e:
        return jsonify({'error': f'Không thể tạo BibTeX bằng AI: {str(e)}'}), 500


@app.route('/convert', methods=['POST'])
def convert():
    conversion_type = request.form.get('type')
    source_text = get_source_text()

    if conversion_type in ('doi2citation', 'doi2bib'):
        return convert_doi_to_bibtex(source_text)

    if conversion_type == 'isbn2bib':
        return convert_isbn_to_bibtex(source_text)

    if conversion_type not in ('bib2ris', 'ris2bib'):
        return jsonify({'error': f'Kiểu chuyển đổi không được hỗ trợ: {conversion_type}'}), 400

    if conversion_type == 'bib2ris':
        return convert_bibtex_to_ris(source_text)
    return convert_ris_to_bibtex(source_text)

@app.route('/download', methods=['POST'])
def download():
    content = request.form.get('content')
    file_type = request.form.get('type', 'ris') # default to ris

    if not content:
        return "Chưa có nội dung", 400

    buffer = io.BytesIO()
    buffer.write(content.encode('utf-8'))
    buffer.seek(0)

    filename = f"converted_references.{file_type}"

    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype='application/octet-stream'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=False)
