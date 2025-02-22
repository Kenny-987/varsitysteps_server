import express from 'express';
import { addPoints, getQuiz, getRandomQuiz, hasPlayed } from '../controllers/quizController';

const router = express.Router()


router.get('/getquiz',getQuiz)
router.get('/getrandomquiz',getRandomQuiz)
router.post('/hasplayed',hasPlayed)
router.patch('/addpoints',addPoints)

export default router
