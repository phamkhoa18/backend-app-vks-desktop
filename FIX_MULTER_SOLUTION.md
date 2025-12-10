# 🔧 GIẢI PHÁP CUỐI CÙNG - Cài Multer bỏ qua lỗi Canvas

## Vấn đề
Canvas đang build fail và ngăn multer được cài.

## ✅ GIẢI PHÁP 1: Cài multer với --no-optional (Khuyên dùng)

Chạy lệnh này:
```bash
npm install multer --no-optional --legacy-peer-deps
```

Flag `--no-optional` sẽ bỏ qua optional dependencies (canvas có thể là optional).

---

## ✅ GIẢI PHÁP 2: Cài multer với --ignore-scripts

Chạy lệnh này:
```bash
npm install multer --ignore-scripts --legacy-peer-deps
```

Flag `--ignore-scripts` sẽ bỏ qua build scripts của canvas.

---

## ✅ GIẢI PHÁP 3: Tạm thời bỏ canvas, cài multer, rồi thêm canvas lại

1. Mở `package.json`, tạm thời comment hoặc xóa dòng canvas:
   ```json
   // "canvas": "^2.11.2",
   ```

2. Cài multer:
   ```bash
   npm install multer --legacy-peer-deps
   ```

3. Thêm canvas lại vào package.json nếu cần.

---

## ✅ GIẢI PHÁP 4: Dùng --force và bỏ qua lỗi

```bash
npm install multer --force --legacy-peer-deps
```

---

## 🎯 KHUYẾN NGHỊ: Giải pháp 1 hoặc 2

Thử lần lượt:
1. `npm install multer --no-optional --legacy-peer-deps`
2. Nếu không được, thử: `npm install multer --ignore-scripts --legacy-peer-deps`

Sau khi cài xong, kiểm tra:
```bash
npm list multer
```

Nếu thấy `multer@1.4.5-lts.x` là thành công!

