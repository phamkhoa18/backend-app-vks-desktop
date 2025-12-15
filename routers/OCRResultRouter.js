import express from 'express';
import OCRResultController from '../controllers/OCRResultController.js';
import { requireAuth, getUserFromRequest } from '../middleware/auth.js';

const router = express.Router();

// Get user from request (optional, but recommended)
router.use(getUserFromRequest);

// All routes require authentication
router.use(requireAuth);

// Save OCR result
// POST /api/v1/ocr-results
router.post('/', OCRResultController.saveOCRResult);

// Get all OCR results for user
// GET /api/v1/ocr-results
router.get('/', OCRResultController.getAllOCRResults);

// Check if file has been OCRed
// POST /api/v1/ocr-results/check
router.post('/check', OCRResultController.checkOCRResult);

// Get OCR result by file hash
// GET /api/v1/ocr-results/:fileHash
router.get('/:fileHash', OCRResultController.getOCRResult);

// Delete OCR result
// DELETE /api/v1/ocr-results/:id
router.delete('/:id', OCRResultController.deleteOCRResult);

export default router;

