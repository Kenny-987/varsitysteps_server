import express from 'express';
import {getMessages,getChats} from '../controllers/messagesController'


const router = express.Router();

router.get('/chats',getChats)
// router.get('/checkchats',checkChat)
router.get('/conversation/:chat_id',getMessages)
// router.post('/send',sendMessages)s
export default router;