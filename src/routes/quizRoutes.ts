import express from 'express';
import { addPoints, getQuiz, hasPlayed } from '../controllers/quizController';

const router = express.Router()


router.get('/getquiz',getQuiz)
router.post('/hasplayed',hasPlayed)
router.patch('/addpoints',addPoints)

export default router
