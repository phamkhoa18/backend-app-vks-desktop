import express from 'express';
import OCRController from '../controllers/OCRController.js';
import OCRControllerPythonProxy from '../controllers/OCRControllerPythonProxySimple.js';
import { getUserFromRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply middleware để lấy user từ request (optional, OCR can work without auth)
router.use(getUserFromRequest);

// Extract text from PDF or Image (Node.js OCR)
// POST /api/v1/ocr/extract-text
// FormData: file (PDF or Image), forceOCR (optional), language (optional)
router.post('/extract-text', OCRController.extractText);

// Extract text using Python OCR service (PaddleOCR - tốt nhất cho tiếng Việt)
// POST /api/v1/ocr/extract-text-python
// FormData: file (PDF or Image), forceOCR (optional), language (optional)
router.post('/extract-text-python', OCRControllerPythonProxy.extractText);

// Health check endpoint (Node.js OCR)
// GET /api/v1/ocr/health
router.get('/health', OCRController.health);

// Python OCR service health check
// GET /api/v1/ocr/python-health
router.get('/python-health', OCRControllerPythonProxy.health);

// Cleanup endpoint (for maintenance)
// POST /api/v1/ocr/cleanup
router.post('/cleanup', OCRController.cleanup);

export default router;
