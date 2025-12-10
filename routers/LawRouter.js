import { Router } from 'express';
import { getHealth, search, getArticle } from '../controllers/LawController.js';

const router = Router();

router.get('/health', getHealth);
router.get('/search', search);
router.get('/articles/:number', getArticle);

export default router;


