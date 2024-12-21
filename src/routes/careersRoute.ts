import express from 'express'
import { getIndustries,getCareersList,insertCareer } from '../controllers/careersController';
const router = express.Router();

router.get('/industries',getIndustries)
router.get('/careerslist/:industry_id',getCareersList)

router.post('/addcareer',insertCareer)

export default router;