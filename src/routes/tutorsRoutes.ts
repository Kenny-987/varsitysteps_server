import express from 'express';
import { uploadFiles } from '../services/awsconfig';
import { getTutors,tutorProfile,getTutorsBySubject,rateTutor,hasRated, uploadTutoringFiles, deleteTutoringFile, getSharedFiles, createClass, getClasses, getClassDetails, AddStudent, removeStudent, editClass, getMyClasses } from '../controllers/tutorsController';

const router = express.Router();
router.get('/', getTutors)
router.get('/search',getTutorsBySubject)
router.get('/tutorprofile/:id',tutorProfile)
router.post('/rate',rateTutor)
router.get('/checkrate/:tutor_id',hasRated)
router.post('/fileupload',uploadFiles.array('files',10),uploadTutoringFiles)
// router.get('/myfiles',getUploadedFiles)
router.delete('/deletefile/:id',deleteTutoringFile)
router.get("/sharedfiles",getSharedFiles)
router.post('/createclass',createClass)
router.get('/getclasses',getClasses)
router.get('/classdetails/:id',getClassDetails)
router.put('/editclass',editClass)
router.post('/addstudent',AddStudent)
router.delete('/remove-student',removeStudent)
router.get('/myclasses',getMyClasses)
export default router;