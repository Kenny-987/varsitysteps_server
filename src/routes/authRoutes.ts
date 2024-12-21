import express from 'express';
import { registerUser, loginUser, logoutUser,resetPassword,otp,newPassword,verifyEmail} from '../controllers/authController';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/reset',resetPassword)
router.post('/otp',otp)
router.post('/newpassword',newPassword)
router.post('/verify',verifyEmail)

export default router;
