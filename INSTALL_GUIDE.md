# Hướng dẫn Cài đặt Dependencies

## Vấn đề

Khi cài đặt dependencies, bạn có thể gặp lỗi với `canvas` trên Windows vì:
- Canvas cần native dependencies (GTK, Cairo) để build
- Node.js v22.11.0 quá mới, không có pre-built binary cho canvas@2.11.2

## Giải pháp

### Cách 1: Sử dụng --legacy-peer-deps (Khuyên dùng)

Multer đã có trong `package.json`, không cần cài lại. Nếu cần cài lại toàn bộ dependencies:

```bash
npm install --legacy-peer-deps
```

### Cách 2: Skip optional dependencies

Nếu canvas gây vấn đề và bạn không cần ngay, có thể skip:

```bash
npm install --no-optional --legacy-peer-deps
```

**Lưu ý:** Nếu skip canvas, OCR sẽ không hoạt động với PDF. Chỉ dùng cách này nếu bạn chỉ cần xử lý ảnh.

### Cách 3: Cài đặt Canvas trên Windows (Đầy đủ nhất)

1. Cài đặt GTK3 cho Windows:
   - Tải từ: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
   - Hoặc dùng Chocolatey: `choco install gtkruntime`

2. Cài đặt Visual Studio Build Tools (nếu chưa có)

3. Sau đó cài dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

## Kiểm tra Multer

Multer đã được khai báo trong `package.json` (line 28). Nếu bạn thấy lỗi khi import multer:

1. Kiểm tra xem multer đã được cài chưa:
   ```bash
   npm list multer
   ```

2. Nếu chưa có, chỉ cần:
   ```bash
   npm install --legacy-peer-deps
   ```

## Tóm tắt

✅ **Multer đã có sẵn trong package.json - KHÔNG CẦN CÀI LẠI**

❌ Lỗi bạn gặp là do **canvas** không thể build, KHÔNG phải do multer

✅ Để fix: Chạy `npm install --legacy-peer-deps` (multer sẽ được cài tự động)

