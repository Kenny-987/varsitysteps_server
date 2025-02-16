import express from 'express'
import {  achievements, followAchievements, getData, leaderboard, leaderboardPosition } from '../controllers/gameData';
const router = express.Router();

router.get('/data',getData)
router.get('/leaderboard',leaderboard)
router.get('/position',leaderboardPosition)
router.get('/challenges',achievements)
router.post('/follower',followAchievements)
export default router;