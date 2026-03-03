# 🏛️ Backend App - Viện Kiểm Sát AI

> **API Server** cho ứng dụng desktop hỗ trợ nghiệp vụ Viện Kiểm Sát, tích hợp AI và OCR.

---

## 📋 Mục lục

- [Tổng quan](#-tổng-quan)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cài đặt](#-cài-đặt)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [API Endpoints](#-api-endpoints)
- [Database Models](#-database-models)
- [Chi tiết từng module](#-chi-tiết-từng-module)
- [Quy tắc code](#-quy-tắc-code)
- [Xử lý lỗi thường gặp](#-xử-lý-lỗi-thường-gặp)

---

## 🎯 Tổng quan

Backend App là **RESTful API Server** được xây dựng bằng **Node.js + Express**, phục vụ các chức năng:

| Chức năng | Mô tả |
|-----------|--------|
| 📁 **Quản lý vụ án** | CRUD vụ án, bị can, trạng thái tố tụng |
| 📝 **Quản lý biểu mẫu** | Sinh văn bản DOCX từ template, chuyển đổi HTML ↔ DOCX |
| 🔍 **OCR xử lý ảnh** | Trích xuất văn bản từ PDF/ảnh bằng Tesseract.js |
| 🤖 **AI trích xuất** | Dùng OpenAI GPT để tự động nhận dạng thông tin vụ án |
| ⚖️ **Tra cứu luật** | Tra cứu Bộ luật Hình sự (BLHS) & Bộ luật Tố tụng Hình sự (BLTTHS) |
| 👤 **Quản lý người dùng** | Đăng ký, đăng nhập, quản lý thông tin KSV |

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Phiên bản | Mục đích |
|------------|-----------|----------|
| **Node.js** | ≥ 18.x | Runtime |
| **Express** | 5.1.0 | Web framework |
| **MongoDB** | ≥ 6.x | Database |
| **Mongoose** | 8.19.3 | ODM (Object Data Modeling) |
| **OpenAI** | 4.104.0 | AI trích xuất thông tin |
| **Tesseract.js** | 5.1.0 | OCR engine |
| **Sharp** | 0.33.5 | Xử lý hình ảnh |
| **Mammoth** | 1.11.0 | Đọc file DOCX |
| **Docxtemplater** | 3.44.0 | Sinh file DOCX từ template |
| **PizZip** | 3.1.4 | Zip/Unzip DOCX |

---

## 🚀 Cài đặt

### Yêu cầu hệ thống

- **Node.js** ≥ 18.x ([Tải tại đây](https://nodejs.org/))
- **MongoDB** ≥ 6.x ([Tải tại đây](https://www.mongodb.com/try/download/community))
- **Git** ([Tải tại đây](https://git-scm.com/))

### Các bước cài đặt

```bash
# 1. Clone repository (nếu chưa có)
git clone <repo-url>
cd backend-app

# 2. Cài đặt dependencies
npm install --legacy-peer-deps

# 3. Tạo file .env từ template
copy .env.example .env       # Windows
# cp .env.example .env       # Linux/Mac

# 4. Sửa file .env với thông tin thực tế
# - MONGO_URI: connection string MongoDB
# - OPENAI_API_KEY: API key từ OpenAI

# 5. Khởi động MongoDB (nếu chạy local)
# Đảm bảo MongoDB service đang chạy

# 6. (Tùy chọn) Import dữ liệu luật
npm run export:law           # Import BLHS
npm run export:law-bltths    # Import BLTTHS

# 7. Chạy server
npm run dev                  # Development (có hot-reload)
# hoặc
npm run start                # Production
```

### Kiểm tra server đang chạy

```bash
# Health check
curl http://localhost:5000/health

# Kết quả mong đợi:
# { "status": "ok", "timestamp": "...", "uptime": ..., "environment": "development" }
```

---

## 📁 Cấu trúc thư mục

```
backend-app/
│
├── 📄 app.js                    # ⭐ Entry point - Khởi tạo Express, kết nối DB, đăng ký routes
├── 📄 package.json              # Dependencies & scripts
├── 📄 .env.example              # Template biến môi trường
├── 📄 .gitignore                # Files bị ignore khi push Git
│
├── 📂 controllers/              # 🎮 Business Logic Layer
│   ├── CaseController.js        #   CRUD vụ án + AI extract thông tin
│   ├── FormSubmissionController.js  #   Quản lý biểu mẫu, sinh DOCX, convert HTML↔DOCX
│   ├── FormDataController.js    #   Lưu/lấy dữ liệu draft của form
│   ├── LawController.js         #   Tra cứu luật BLHS, BLTTHS
│   ├── OCRController.js         #   OCR xử lý ảnh/PDF bằng Tesseract.js
│   ├── OCRControllerPythonProxySimple.js  #   Proxy tới Python OCR service
│   ├── OCRResultController.js   #   Quản lý kết quả OCR đã lưu
│   └── UsersController.js       #   Đăng ký, đăng nhập, CRUD user
│
├── 📂 models/                   # 🗃️ Database Models (Mongoose Schemas)
│   ├── Case.js                  #   Schema vụ án (vụ án, bị can, tạm giam...)
│   ├── FormSubmission.js        #   Schema biểu mẫu đã submit
│   ├── FormData.js              #   Schema lưu draft data của form
│   ├── OCRResult.js             #   Schema kết quả OCR
│   └── Users.js                 #   Schema người dùng (KSV)
│
├── 📂 routers/                  # 🛤️ Route Definitions
│   ├── CaseRouter.js            #   /api/v1/cases/*
│   ├── FormRouter.js            #   /api/v1/forms/*
│   ├── LawRouter.js             #   /api/v1/law/*
│   ├── OCRRouter.js             #   /api/v1/ocr/*
│   ├── OCRResultRouter.js       #   /api/v1/ocr-results/*
│   └── UsersRouter.js           #   /api/v1/users/*
│
├── 📂 middleware/               # 🔒 Middleware
│   └── auth.js                  #   Xác thực user (getUserFromRequest, requireAuth)
│
├── 📂 services/                 # ⚙️ Service Layer
│   └── DocxService.js           #   Xử lý sinh file DOCX từ template
│
├── 📂 utils/                    # 🔧 Utilities
│   ├── connectDB.js             #   Kết nối MongoDB
│   ├── lawJsonProvider.js       #   Cung cấp dữ liệu luật từ JSON
│   └── parseLawBLHS.js          #   Parse văn bản luật thành JSON
│
├── 📂 forms/                    # 📋 Template DOCX & HTML
│   ├── dieutra/                 #   Biểu mẫu giai đoạn điều tra
│   │   ├── QĐ_GIAHANTAMGIAM/   #     Quyết định gia hạn tạm giam
│   │   ├── QĐ_PHECHUANLENHTAMGIAM/  #  QĐ phê chuẩn lệnh tạm giam
│   │   ├── QĐ_PHECHUANQUYETDINHKHOITO/  # QĐ phê chuẩn QĐ khởi tố
│   │   └── YC_DIEUTRA/         #     Yêu cầu điều tra
│   └── truyto/                  #   Biểu mẫu giai đoạn truy tố
│       ├── CAOTRANG/            #     Cáo trạng
│       ├── LENHTAMGIAM_TRUYTO/  #     Lệnh tạm giam truy tố
│       └── THONGBAO_BICANTAMGIAM/ #   Thông báo bị can tạm giam
│
├── 📂 data/                     # 📊 Dữ liệu tĩnh
│   ├── law_BLHS.json            #   Bộ luật Hình sự (JSON)
│   ├── law_BLHS.txt             #   Bộ luật Hình sự (text gốc)
│   ├── law_BLTTHS.json          #   Bộ luật TTHS (JSON)
│   └── law_BLTTHS.txt           #   Bộ luật TTHS (text gốc)
│
└── 📂 scripts/                  # 📜 Scripts tiện ích
    ├── exportLawBLHS.js         #   Script import BLHS vào JSON
    └── exportLawBLTTHS.js       #   Script import BLTTHS vào JSON
```

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Electron App)                      │
│                  uxui-app-desktop (React)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER                            │
│                      (app.js)                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  CORS    │  │  Morgan  │  │  JSON    │  │  Auth    │    │
│  │Middleware│  │  Logger  │  │ Parser   │  │Middleware│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────────── ROUTERS ────────────────────────────┐    │
│  │ /api/v1/users    │ /api/v1/cases   │ /api/v1/law   │    │
│  │ /api/v1/forms    │ /api/v1/ocr     │ /api/v1/ocr-* │    │
│  └──────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌──────────────── CONTROLLERS ───────────────────────┐     │
│  │ UsersController  │ CaseController  │ LawController │     │
│  │ FormController   │ OCRController   │ OCRResult     │     │
│  └──────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌──────────────── SERVICES ──────────────────────────┐     │
│  │ DocxService      │ lawJsonProvider │ OpenAI API    │     │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ MongoDB  │ │ OpenAI   │ │ Python   │
        │(Mongoose)│ │   API    │ │OCR Server│
        └──────────┘ └──────────┘ └──────────┘
```

### Luồng xử lý request

```
Request → Router → (Auth Middleware) → Controller → Service/Model → Response
```

---

## 📡 API Endpoints

### 👤 Users (`/api/v1/users`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| `POST` | `/register` | Đăng ký tài khoản mới | ❌ |
| `POST` | `/login` | Đăng nhập | ❌ |
| `GET` | `/:id` | Lấy thông tin user | ❌ |
| `PUT` | `/:id` | Cập nhật thông tin user | ❌ |

### 📁 Cases (`/api/v1/cases`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| `GET` | `/` | Danh sách tất cả vụ án | ❌ |
| `GET` | `/:id` | Chi tiết vụ án theo ID | ❌ |
| `POST` | `/` | Tạo vụ án mới | ❌ |
| `POST` | `/extract` | AI trích xuất thông tin vụ án từ text | ❌ |
| `POST` | `/:caseId/merge-bi-can` | Merge bị can vào vụ án | ❌ |
| `PUT` | `/:id` | Cập nhật vụ án | ❌ |
| `DELETE` | `/:id` | Xóa vụ án | ❌ |

### 📝 Forms (`/api/v1/forms`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| `GET` | `/templates` | Danh sách template có sẵn | ❌ |
| `GET` | `/` | Tất cả form submissions | ❌ |
| `GET` | `/position/:position` | Form theo loại biểu mẫu | ❌ |
| `GET` | `/:id` | Chi tiết form submission | ❌ |
| `POST` | `/` | Tạo form submission mới | ✅ |
| `POST` | `/generate-docx` | Sinh file DOCX từ template | ❌ |
| `POST` | `/html-to-docx` | Chuyển HTML sang DOCX | ❌ |
| `POST` | `/parse-docx-to-html` | Chuyển DOCX sang HTML | ❌ |
| `POST` | `/parse-docx-template-to-html` | Parse template DOCX gốc sang HTML | ❌ |
| `PUT` | `/:id` | Cập nhật form submission | ✅ |
| `DELETE` | `/:id` | Xóa form submission | ✅ |
| `GET` | `/data/get-or-create` | Lấy hoặc tạo draft data | ✅ |
| `POST` | `/data/save` | Lưu draft data | ✅ |
| `GET` | `/data/:position` | Lấy draft data theo position | ✅ |
| `DELETE` | `/data/:position` | Xóa draft data | ✅ |
| `GET` | `/data` | Tất cả draft data của user | ✅ |

### 🔍 OCR (`/api/v1/ocr`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| `POST` | `/upload` | Upload ảnh/PDF để OCR | ❌ |
| `POST` | `/process` | Xử lý OCR | ❌ |

### 📦 OCR Results (`/api/v1/ocr-results`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| `GET` | `/` | Danh sách kết quả OCR | ❌ |
| `GET` | `/check` | Kiểm tra kết quả OCR đã tồn tại | ❌ |
| `POST` | `/` | Lưu kết quả OCR | ❌ |
| `DELETE` | `/:id` | Xóa kết quả OCR | ❌ |

### ⚖️ Law (`/api/v1/law`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| `GET` | `/` | Tra cứu luật (BLHS, BLTTHS) | ❌ |

> **Ghi chú Auth**: ✅ = yêu cầu header `x-user-id`, ❌ = không yêu cầu

---

## 🗃️ Database Models

### Case (Vụ án)
```
Case
├── vu_an (VuAnSchema)              # Thông tin vụ án
│   ├── ma_vu_an                    # Mã vụ án (unique)
│   ├── ten_vu_an                   # Tên vụ án
│   ├── trang_thai                  # khoi_to | dang_dieu_tra | da_truy_to | dang_xet_xu | da_ket_thuc
│   ├── dieu_khoan_diem[]           # Điều, khoản, điểm vi phạm
│   └── ...                         # Ngày khởi tố, cơ quan, địa điểm...
├── bi_can[] (BiCanSchema)          # Danh sách bị can
│   ├── ho_ten, ngay_sinh, cccd     # Thông tin cá nhân
│   ├── tinh_trang_ngan_chan        # tu_do | tam_giu | tam_giam | cam_di_khoi_noi_cu_tru
│   ├── tien_an[] (TienAnSchema)    # Tiền án
│   └── ...                         # Gia đình, nghề nghiệp...
├── qd_khoi_to_bi_can              # QĐ khởi tố bị can
├── de_nghi_phe_chuan_khoi_to_bi_can # Đề nghị phê chuẩn
├── lenh_tam_giam                  # Lệnh tạm giam
├── bao_cao                        # Báo cáo
├── created_by → User              # Người tạo
└── timestamps                     # createdAt, updatedAt
```

### User (Người dùng - KSV)
```
User
├── email (unique)                  # Email đăng nhập
├── password                       # Mật khẩu (hash)
├── name                           # Tên hiển thị
├── role                           # user | admin
└── thongtin_ksv                   # Thông tin kiểm sát viên
    ├── tenksv                     # Tên KSV
    ├── chucdanh                   # Chức danh
    ├── donvi                      # Đơn vị
    ├── ten_day_du_vks             # Tên đầy đủ VKS
    ├── vientruong                 # Viện trưởng
    ├── phovientruong[]            # Phó viện trưởng
    └── ...
```

### FormSubmission (Biểu mẫu đã submit)
```
FormSubmission
├── position                       # Loại biểu mẫu (vd: giahantamgiam)
├── content                        # Nội dung HTML
├── case_id → Case                 # Liên kết vụ án
├── user_id → User                 # Người tạo
└── metadata                       # Thông tin bổ sung
```

### OCRResult (Kết quả OCR)
```
OCRResult
├── file_name                      # Tên file gốc
├── text                           # Nội dung trích xuất
├── confidence                     # Độ tin cậy
└── user_id → User                 # Người upload
```

---

## 📖 Chi tiết từng module

### 1. Module Vụ án (`CaseController.js`)

**Mục đích**: Quản lý toàn bộ lifecycle của vụ án hình sự.

**Chức năng đặc biệt**:
- `extractCaseInfo`: Sử dụng **OpenAI GPT** để phân tích văn bản OCR và tự động trích xuất thông tin vụ án (bị can, tội danh, điều khoản...) thành dữ liệu có cấu trúc.
- `mergeBiCanToCase`: Gộp thông tin bị can mới vào vụ án đã có.

### 2. Module Biểu mẫu (`FormSubmissionController.js`)

**Mục đích**: Sinh văn bản pháp lý từ template DOCX.

**Luồng xử lý sinh DOCX**:
```
1. Client gửi { position, data }
2. Server tìm template .docx trong thư mục forms/
3. Dùng Docxtemplater điền data vào template
4. Trả về file DOCX cho client download
```

**Luồng chuyển đổi HTML ↔ DOCX**:
```
HTML → DOCX: Dùng html-docx-js + xử lý format tùy chỉnh
DOCX → HTML: Dùng Mammoth + parse XML trực tiếp để giữ format
```

### 3. Module OCR (`OCRController.js`)

**Mục đích**: Trích xuất văn bản từ ảnh/PDF.

**Công nghệ**:
- **Tesseract.js**: OCR engine chạy trên Node.js
- **Sharp**: Tiền xử lý ảnh (resize, contrast, grayscale...)
- **pdf-parse / pdfjs-dist**: Đọc file PDF

### 4. Module Luật (`LawController.js`)

**Mục đích**: Tra cứu Bộ luật Hình sự và Bộ luật TTHS.

**Dữ liệu**: Được parse từ file `.txt` gốc thành `.json` có cấu trúc (Phần → Chương → Điều → Khoản → Điểm).

### 5. Module Authentication (`middleware/auth.js`)

**Cơ chế xác thực hiện tại**:
- Dùng header `x-user-id` gửi MongoDB ObjectId
- Middleware `getUserFromRequest`: Không bắt buộc, set `req.user`
- Middleware `requireAuth`: Bắt buộc có user, trả 401 nếu không có

> ⚠️ **Lưu ý**: Hệ thống hiện dùng simple auth (x-user-id header), chưa implement JWT token. Sẽ cần nâng cấp cho production.

---

## 📏 Quy tắc code

### Cấu trúc project
- **ESM Module**: Sử dụng `import/export` (không dùng `require`)
- **Pattern**: MVC pattern (Model - View - Controller), không có View vì là API server
- **Naming**:
  - File Controller: `PascalCase` + `Controller.js` (vd: `CaseController.js`)
  - File Router: `PascalCase` + `Router.js` (vd: `CaseRouter.js`)
  - File Model: `PascalCase` + `.js` (vd: `Case.js`)
  - Schema fields MongoDB: `snake_case` (vd: `ma_vu_an`, `ho_ten`)
  - API endpoints: `kebab-case` (vd: `/generate-docx`, `/html-to-docx`)

### Quy ước API Response

```javascript
// Thành công
{
  success: true,
  data: { ... },  // hoặc []
  message: "..."  // tùy chọn
}

// Lỗi
{
  success: false,
  message: "Mô tả lỗi"
}
```

### Thêm module mới

1. Tạo **Model** trong `models/`
2. Tạo **Controller** trong `controllers/`
3. Tạo **Router** trong `routers/`
4. Đăng ký router trong `app.js`:
   ```javascript
   import NewRouter from './routers/NewRouter.js';
   app.use('/api/v1/new-feature', NewRouter);
   ```

---

## ⚠️ Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách fix |
|------|-------------|----------|
| `MongoDB connection failed` | MongoDB chưa chạy | Khởi động MongoDB service |
| `MONGO_URI not found` | Chưa tạo file `.env` | Copy `.env.example` thành `.env` |
| `sharp module error` | Sharp chưa build đúng | Chạy `npm run fix:sharp` hoặc `npm run fix:all` |
| `EADDRINUSE :5000` | Port 5000 đang bị chiếm | Đổi PORT trong `.env` hoặc tắt process đang chiếm |
| `Cannot find module` | Thiếu dependency | Chạy `npm install --legacy-peer-deps` |

---

## 📜 Scripts có sẵn

```bash
npm run dev              # Chạy với nodemon (auto-reload khi sửa code)
npm run start            # Chạy production
npm run export:law       # Import Bộ luật Hình sự
npm run export:law-bltths # Import Bộ luật TTHS
npm run install:all      # Cài đặt tất cả dependencies
npm run fix:sharp        # Fix lỗi module sharp
npm run fix:all          # Fix sharp + reinstall
```

---

## 👥 Đóng góp

1. Tạo branch mới từ `main`: `git checkout -b feature/ten-chuc-nang`
2. Code và test kỹ
3. Commit với message rõ ràng: `git commit -m "feat: thêm chức năng XYZ"`
4. Push và tạo Pull Request: `git push origin feature/ten-chuc-nang`

### Commit Convention
```
feat: thêm chức năng mới
fix: sửa lỗi
docs: cập nhật tài liệu
refactor: tái cấu trúc code
style: sửa format, không thay đổi logic
```

---

> 💡 **Lưu ý bảo mật**: Không bao giờ commit file `.env` chứa API key thật lên Git. Luôn sử dụng `.env.example` làm template.
