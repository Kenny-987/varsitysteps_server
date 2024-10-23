import express from 'express';
import { connectionRequest,connectionResponse,checkConnection, getNotifications,markAsRead,getRequets } from '../controllers/requestController';

const router = express.Router();
router.post('/connectionrequest',connectionRequest)
router.post('/connectionresponse/:requestId',connectionResponse)
router.post('/connectionstatus',checkConnection)
router.get('/requests/:reciever_id',getRequets)
router.get('/notifications',getNotifications)
router.patch('/markread',markAsRead)
export default router;