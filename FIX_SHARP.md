# 🔧 SỬA LỖI SHARP

## Vấn đề
```
Error: Could not load the "sharp" module using the win32-x64 runtime
```

Sharp cần được rebuild cho Windows platform.

## ✅ GIẢI PHÁP

Chạy lệnh này trong thư mục `backend-app`:

```bash
npm install --include=optional sharp
```

Hoặc:

```bash
npm rebuild sharp
```

Hoặc cài lại sharp cho platform hiện tại:

```bash
npm install --os=win32 --cpu=x64 sharp
```

## ⚡ Nhanh nhất

Xóa node_modules/sharp và cài lại:

```bash
npm uninstall sharp
npm install sharp --legacy-peer-deps
```

## 📋 Sau khi fix

Chạy lại server:
```bash
nodemon app.js
```

## ℹ️ Lưu ý

Sharp là cần thiết cho OCR để:
- Preprocess images (grayscale, contrast, sharpen)
- Resize images
- Optimize images cho OCR

Không thể bỏ sharp nếu muốn OCR hoạt động tốt!

