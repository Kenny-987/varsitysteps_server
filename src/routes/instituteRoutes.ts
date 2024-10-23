import express from 'express';
import {getInstitutions,institutionDetails,searchInstitution} from '../controllers/instituteController'
const router = express.Router();
router.get('/',getInstitutions)
router.get('/search',searchInstitution)
router.get('/institute',institutionDetails)

export default router;