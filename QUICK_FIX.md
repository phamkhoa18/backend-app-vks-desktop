# 🚨 CÁCH SỬA LỖI MULTER NGAY

## Vấn đề
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'multer'
```

Multer đã có trong `package.json` nhưng chưa được cài vào `node_modules`.

## Giải pháp nhanh

### Cách 1: Cài multer riêng (Khuyên dùng - nhanh nhất)

Mở terminal trong thư mục `backend-app` và chạy:

```bash
npm install multer --legacy-peer-deps
```

### Cách 2: Cài tất cả dependencies

```bash
npm install --legacy-peer-deps
```

### Cách 3: Dùng npm script

```bash
npm run install:multer
```

## Sau khi cài xong

Chạy lại server:
```bash
nodemon app.js
```

## Lưu ý

- `--legacy-peer-deps` giúp bỏ qua conflict với canvas
- Multer sẽ được cài mà không ảnh hưởng đến các package khác
- Nếu vẫn gặp lỗi, có thể canvas cần được cài đặt (nhưng không bắt buộc nếu chỉ dùng OCR cho ảnh)

## Kiểm tra

Sau khi cài, kiểm tra xem multer đã có chưa:
```bash
npm list multer
```

Nếu thấy `multer@1.4.5-lts.2` là OK!

