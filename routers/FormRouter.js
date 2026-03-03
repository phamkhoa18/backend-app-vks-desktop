import express from 'express';
import FormSubmissionController from '../controllers/FormSubmissionController.js';
import FormDataController from '../controllers/FormDataController.js';
import { getUserFromRequest, requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply middleware để lấy user từ request
router.use(getUserFromRequest);

// Routes
// Lấy danh sách các template có sẵn
router.get('/templates', FormSubmissionController.getAvailableTemplates);

// Generate DOCX từ template và data
// POST /api/v1/forms/generate-docx
router.post('/generate-docx', FormSubmissionController.generateDocx);

// Convert HTML sang DOCX
// POST /api/v1/forms/html-to-docx
router.post('/html-to-docx', FormSubmissionController.htmlToDocx);

// Parse DOCX template gốc (không có data) sang HTML để xem trước
// POST /api/v1/forms/parse-docx-template-to-html
router.post('/parse-docx-template-to-html', FormSubmissionController.parseDocxTemplateToHtml);

// Parse DOCX sang HTML (giữ format từ template)
// POST /api/v1/forms/parse-docx-to-html
router.post('/parse-docx-to-html', FormSubmissionController.parseDocxToHtml);

// Lấy tất cả form submissions (có thể filter theo query params)
router.get('/', FormSubmissionController.getAllFormSubmissions);

// Lấy form submissions theo position (form name)
// Ví dụ: GET /api/v1/forms/position/giahantamgiam
router.get('/position/:position', FormSubmissionController.getFormSubmissionsByPosition);

// Lấy form submission theo ID (phải đặt sau các route cụ thể)
router.get('/:id', FormSubmissionController.getFormSubmissionById);

// Tạo form submission mới (yêu cầu authentication)
router.post('/', requireAuth, FormSubmissionController.createFormSubmission);

// Cập nhật form submission (yêu cầu authentication)
router.put('/:id', requireAuth, FormSubmissionController.updateFormSubmission);

// Xóa form submission (yêu cầu authentication)
router.delete('/:id', requireAuth, FormSubmissionController.deleteFormSubmission);

// ========== Form Data Routes (lưu draft data) ==========
// Lấy hoặc tạo form data
router.get('/data/get-or-create', requireAuth, FormDataController.getOrCreateFormData);

// Lưu form data
router.post('/data/save', requireAuth, FormDataController.saveFormData);

// Lấy form data theo position
router.get('/data/:position', requireAuth, FormDataController.getFormData);

// Xóa form data
router.delete('/data/:position', requireAuth, FormDataController.deleteFormData);

// Lấy tất cả form data của user
router.get('/data', requireAuth, FormDataController.getAllFormData);

export default router;

