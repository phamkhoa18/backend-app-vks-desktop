# 🔧 CÁCH SỬA LỖI MULTER - CHẠY LỆNH NÀY

## Lỗi bạn đang gặp
```
npm error ERESOLVE could not resolve
npm error Conflicting peer dependency: canvas@3.2.0
```

## ✅ GIẢI PHÁP - Chạy lệnh này:

```bash
npm install multer --legacy-peer-deps
```

**QUAN TRỌNG:** Phải có `--legacy-peer-deps` ở cuối lệnh!

---

## Nếu vẫn không được, thử:

```bash
npm install --legacy-peer-deps
```

Lệnh này sẽ cài tất cả dependencies bao gồm cả multer.

---

## Sau khi cài xong:

Kiểm tra multer đã được cài chưa:
```bash
npm list multer
```

Nếu thấy `multer@1.4.5-lts.x` là thành công!

Rồi chạy lại server:
```bash
nodemon app.js
```

---

## Tại sao cần --legacy-peer-deps?

- Bỏ qua conflict giữa canvas@2.11.2 và jsdom (cần canvas@3.2.0)
- Cho phép cài multer mà không bị chặn
- An toàn, không ảnh hưởng đến app

