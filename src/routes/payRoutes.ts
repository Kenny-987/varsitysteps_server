import express from 'express';
import { approvePayments, getPayments, payment } from '../controllers/paymentsController';
import {uploadProof} from '../services/awsconfig'

const router = express.Router();
router.post('/uploadproof',uploadProof.single('proof'),payment)
router.get('/getpayments',getPayments)
router.post('/approvepayments',approvePayments)
export default router;