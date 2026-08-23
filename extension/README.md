# Tiện ích mở rộng trình duyệt: Citation to BibTeX (Universal Reference Extractor)

Browser Extension (chuẩn **Manifest V3**) giúp tự động trích xuất các tài liệu tham khảo khoa học (**DOI, arXiv, ISBN, Book, Web Metadata**) thành định dạng trích dẫn **BibTeX** chuẩn chỉ trong 1 cú nhấp chuột hoặc thông qua menu chuột phải, hỗ trợ **tự động sao chép vào Clipboard (Auto-copy)**.

---

## 🌟 Tính năng nổi bật

1. **Hỗ trợ đa dạng loại tài liệu tham khảo (Universal Support)**:
   - **DOI**: Các bài báo trên Nature, IEEE Xplore, ScienceDirect, Springer, ACM, Wiley, PLOS, v.v.
   - **arXiv**: Tự động nhận diện mã bài báo arXiv (vd: `arXiv:2301.12345` hoặc `arxiv.org/abs/...`).
   - **ISBN**: Sách và ấn bản học thuật (sử dụng OpenLibrary / Crossref metadata).
   - **Web Article Metadata**: Quét các thẻ meta học thuật (`citation_title`, `citation_author`, `citation_journal_title`, `citation_date`,...) để tự tạo BibTeX nếu trang không có mã DOI.

2. **Menu chuột phải thông minh (Context Menu)**:
   - **Bôi đen văn bản**: Bôi đen bất kỳ đoạn văn bản nào chứa DOI, link bài báo, mã arXiv, hay ISBN $\rightarrow$ Chuột phải $\rightarrow$ Chọn **"Trích xuất BibTeX từ nội dung đã chọn"**.
   - **Chuột phải vào liên kết**: Chuột phải vào bất kỳ link DOI / bài báo nào $\rightarrow$ Chọn **"Trích xuất BibTeX từ liên kết này"**.
   - Extension sẽ tự nhận diện loại định danh, lấy BibTeX và **tự động sao chép vào Clipboard**, kèm thông báo notification trực quan.

3. **Tính năng Tự động sao chép (Auto-copy to Clipboard)**:
   - Tự động copy BibTeX vào Clipboard ngay khi trích xuất xong (có công tắc bật/tắt trong Popup).

4. **Giao diện Popup hiện đại & Tiện dụng**:
   - Tự động quét và liệt kê tất cả tài liệu tham khảo tìm thấy trên tab hiện tại (cho phép chuyển đổi qua dropdown).
   - Cho phép nhập / dán thủ công bất kỳ DOI, arXiv ID, ISBN, hoặc thông tin bài viết.
   - Nhận diện nhãn tự động (`DOI`, `ARXIV`, `ISBN`, `URL`).
   - Tùy chỉnh **Citation Key** (`{citeKey}`) theo chuẩn của riêng bạn.
   - **1-Click Copy**, **Tải file `.bib`**, hoặc **Mở trên Web App** (`bib2ris`).
   - **Lịch sử tra cứu gần đây** (lưu trữ cục bộ an toàn bằng `chrome.storage.local`).

---

## 🚀 Hướng dẫn cài đặt vào trình duyệt

Hoạt động trên tất cả các trình duyệt nhân Chromium (**Google Chrome, Microsoft Edge, Brave, Cốc Cốc, Opera**,...).

### Bước 1: Mở trang quản lý Tiện ích mở rộng
- **Google Chrome / Brave / Cốc Cốc**: Nhập `chrome://extensions/`
- **Microsoft Edge**: Nhập `edge://extensions/`

### Bước 2: Bật chế độ dành cho nhà phát triển (Developer Mode)
- Gạt nút bật **"Developer mode"** (hoặc *"Chế độ dành cho nhà phát triển"*) ở góc trên bên phải.

### Bước 3: Nạp tiện ích (Load Unpacked)
1. Nhấp vào nút **"Load unpacked"** (hoặc *"Tải tiện ích đã giải nén"*).
2. Chọn thư mục `extension` trong dự án này:
   ```text
   E:\ProjectPyCharm\bibtex2ris\extension
   ```
3. Tiện ích **"Citation to BibTeX - Reference Extractor"** đã sẵn sàng!

---

## 💡 Cách sử dụng

### 1. Sử dụng Popup trên trang bài báo
- Mở một trang bài báo bất kỳ (Nature, arXiv, IEEE, ScienceDirect,...).
- Nhấp vào icon tiện ích trên thanh công cụ trình duyệt.
- Tiện ích tự động nhận diện tài liệu, lấy BibTeX và **tự động copy vào clipboard**. Bạn chỉ cần nhấn `Ctrl+V` (hoặc `Cmd+V`) vào Overleaf / Obsidian / LaTeX / Word!

### 2. Sử dụng Menu chuột phải (Bôi đen + Chuột phải)
- Bôi đen một mã DOI (vd: `10.1038/nature12373`) hoặc một link bài báo trên bất kỳ trang web nào.
- Nhấp chuột phải $\rightarrow$ Chọn **"Trích xuất BibTeX từ nội dung đã chọn"**.
- BibTeX được copy ngay lập tức vào clipboard và hiển thị thông báo thành công.

---

## 📁 Cấu trúc mã nguồn

```text
extension/
├── manifest.json              # Khai báo Manifest V3
├── background.js              # Service Worker (Context Menu, Auto-copy, arXiv/ISBN/DOI routing)
├── content.js                 # Content Script đa năng phát hiện DOI, arXiv, ISBN & Metadata trang
├── popup/
│   ├── popup.html             # Giao diện Popup tổng quát đa định dạng
│   ├── popup.css              # Giao diện CSS hiện đại (hỗ trợ Dark / Light mode)
│   └── popup.js               # Xử lý trích xuất, Auto-copy, đổi Citation Key, lịch sử
├── icons/                     # Bộ Icon các kích thước
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
└── README.md                  # Hướng dẫn sử dụng này
```
