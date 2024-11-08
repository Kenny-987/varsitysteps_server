import express from 'express';
import { getTutors,tutorProfile,getTutorsBySubject,rateTutor,hasRated } from '../controllers/tutorsController';

const router = express.Router();
router.get('/', getTutors)
router.get('/search',getTutorsBySubject)
router.get('/tutorprofile/:id',tutorProfile)
router.post('/rate',rateTutor)
router.get('/checkrate/:tutor_id',hasRated)
export default router;