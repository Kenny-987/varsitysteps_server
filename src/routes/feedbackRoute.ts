import express from 'express';
import { feedback } from '../controllers/feedbackController';

const router = express.Router();
router.post('/send',feedback)
export default router;