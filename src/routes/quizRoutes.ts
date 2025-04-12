import express from 'express';
import { addPoints, getQuiz, getRandomQuiz, hasPlayed ,getQuestions} from '../controllers/quizController';

const router = express.Router()


router.get('/getquizzes',getQuiz)
router.get('/getquestions',getQuestions)
router.get('/getrandomquiz',getRandomQuiz)
router.post('/hasplayed',hasPlayed)
router.patch('/addpoints',addPoints)

export default router
