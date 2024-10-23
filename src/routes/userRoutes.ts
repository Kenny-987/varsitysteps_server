import express from 'express';
import { editUser,editImage,deleteProfileImage, editPassword,getStudents, getUserInfo, studentProfile,getMyTutors,creacteCreator } from '../controllers/userController';
import {upload} from '../services/awsconfig'

const router = express.Router();
router.patch('/update/:userId', editUser);
router.post('/profile-picture',upload.single('profilePicture'),editImage)
router.post('/creator-account',creacteCreator)
router.delete('/delete-picture/:userId',deleteProfileImage)
router.put('/update/password/:userId',editPassword)
router.get('/mystudents',getStudents)
router.get('/mytutors',getMyTutors)
router.get('/info', getUserInfo)
router.get('/studentprofile/:id',studentProfile)

export default router;