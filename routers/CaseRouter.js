import express from 'express';
import CaseController from '../controllers/CaseController.js';
import { getUserFromRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply middleware để lấy user từ request (không bắt buộc)
router.use(getUserFromRequest);

// Routes
router.get('/', CaseController.getAllCases);
router.get('/:id', CaseController.getCaseById);
router.post('/', CaseController.createCase);
router.put('/:id', CaseController.updateCase);
router.delete('/:id', CaseController.deleteCase);

export default router;

