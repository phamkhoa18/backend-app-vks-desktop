# 🐍 Setup Python OCR Service - Hướng dẫn đầy đủ

## 📋 Tổng quan

Python OCR Service sử dụng **PaddleOCR** - thư viện OCR tốt nhất cho tiếng Việt, tách biệt khỏi Node.js backend để tránh các vấn đề với canvas và pdfjs-dist.

## 🚀 Cài đặt

### Bước 1: Cài đặt Python (nếu chưa có)

**Windows:**
- Download từ: https://www.python.org/downloads/
- Đảm bảo check "Add Python to PATH"
- Python 3.8+ được khuyên dùng

**Kiểm tra:**
```bash
python --version
```

### Bước 2: Setup Python Service

```bash
cd ocr-service-python

# Tạo virtual environment (khuyên dùng)
python -m venv venv

# Kích hoạt venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Cài dependencies
pip install -r requirements.txt
```

### Bước 3: Cài đặt Poppler (cho PDF)

**Windows:**
1. Download: https://github.com/oschwartz10612/poppler-windows/releases
2. Giải nén vào thư mục (ví dụ: `C:\poppler`)
3. Thêm `C:\poppler\Library\bin` vào PATH
4. Hoặc dùng Chocolatey: `choco install poppler`

**Kiểm tra:**
```bash
pdftoppm -h
```

### Bước 4: Chạy Python Service

```bash
python app.py
```

Bạn sẽ thấy:
```
Đang khởi tạo PaddleOCR cho tiếng Việt...
✅ PaddleOCR đã sẵn sàng!
🚀 OCR Service đang chạy trên port 5001
```

**Lưu ý:** Lần đầu chạy, PaddleOCR sẽ download models (có thể mất vài phút). Models sẽ được cache cho lần sau.

## 🔧 Tích hợp với Node.js

### Option 1: Frontend gọi trực tiếp Python API (Đơn giản nhất)

Cập nhật `ocrService.ts`:

```typescript
const PYTHON_OCR_URL = import.meta.env.VITE_PYTHON_OCR_URL || 'http://localhost:5001';

// Thay đổi extractTextFromBackend để gọi Python API
async extractTextFromBackend(file: File, options, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.forceOCR) formData.append('forceOCR', 'true');
  
  const response = await fetch(`${PYTHON_OCR_URL}/extract-text`, {
    method: 'POST',
    body: formData,
  });
  
  return await response.json();
}
```

### Option 2: Node.js forward request (Nếu cần qua proxy)

1. Cài form-data:
```bash
cd backend-app
npm install form-data
```

2. Sử dụng endpoint:
```
POST /api/v1/ocr/extract-text-python
```

## 📡 API Endpoints

### Python Service

- `GET /health` - Health check
- `POST /extract-text` - Extract text từ PDF/Image

### Node.js (nếu dùng proxy)

- `GET /api/v1/ocr/python-health` - Check Python service
- `POST /api/v1/ocr/extract-text-python` - Forward tới Python

## ✅ Ưu điểm

- ✅ **PaddleOCR** - Tốt nhất cho tiếng Việt (90-95% accuracy)
- ✅ Không cần canvas - Xử lý PDF bằng PyMuPDF
- ✅ Không cần worker setup
- ✅ Image preprocessing tốt với OpenCV
- ✅ Hỗ trợ cả PDF có text và PDF scan

## 🆘 Troubleshooting

### Lỗi: Module not found
```bash
pip install -r requirements.txt
```

### Lỗi: Poppler not found
Cài Poppler và thêm vào PATH

### Models download chậm
Lần đầu sẽ download, sau đó sẽ cache

### Port 5001 đã được sử dụng
Đổi port trong `.env`:
```env
PORT=5002
```

## 📝 Notes

- Python service chạy độc lập với Node.js
- Có thể chạy trên server khác
- Models được cache tự động

