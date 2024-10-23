import express from 'express';
import { getTutors,tutorProfile,getTutorsBySubject } from '../controllers/tutorsController';

const router = express.Router();
router.get('/', getTutors)
router.get('/search',getTutorsBySubject)
router.get('/tutorprofile/:id',tutorProfile)
export default router;