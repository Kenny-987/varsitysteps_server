import { Request, Response } from 'express';
import { client } from '../services/connect';
import { sendMail } from '../services/mail';

export async function payment(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const {phone} =req.body
            const file = req.file as any

            
            let confirmation_number
            
            if(phone){
                confirmation_number= phone
            }else{
                confirmation_number=null
            }
            //insert proof into aws bucket
            const user_id = req.user.id
            if (!file) {
                console.log('no file')
                return res.status(400).json({ message: 'No file uploaded' });
              }
            const proofUrl = file.location
             await client.query(`INSERT INTO payments(user_id,proof,confirmation_number) VALUES ($1,$2,$3)`, [user_id, proofUrl,confirmation_number]);
             const email = 'kennethmadondo01@gmail.com'
             const subject = `New Payment uploaded`
             const emailmessage = `New payment uploaded`
             
             if(email){
                await  sendMail(email,subject,emailmessage)
               }
            res.status(200).json({message:'proof submitted'})
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'Internal Server error'})
        }
    }
}

//get payment data
export async function getPayments(req:Request,res:Response) {
    try {
        const payments = await client.query(`
            select username,users.id,payments.*
            from users
            JOIN payments 
            ON payments.user_id = users.id
            `)
            res.status(200).json(payments.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal server error'})
    }
}

//approve payments
export async function approvePayments(req:Request,res:Response) {
    try {
        const {user_id,approvalStatus}=req.body
        if(approvalStatus == true){
        const result =  await client.query(`
            UPDATE users SET is_premium = true WHERE id = $1 RETURNING users.email
            `,[user_id])
            // set up notifications for payment update
        // await client.query(`     
        //     INSERT INTO notifications`
        // )   
            const email = result.rows[0].email;
            const subject = `VarsitySteps Premium Payment Approval`
            const emailmessage = `You payment for VarsitySteps Premium has been approved. Thank you for your support.\n\n
            You will be notified 7 days, and 1 day before your membership expires.\n\n
            Should you choose not to extend your premium membership, your WhatsApp number will be hidden from your profile viewers and and only the first two of your subjects will be displayed, but you can edit your profile and select the ones you want to display.\n\n
            Yours Sincerely
            VarsitySteps
            `
            await  sendMail(email,subject,emailmessage)  
            res.status(200).json({messsage:'user approved'})
        }else{
            const result =  await client.query(`
            SELECT email FROM users  WHERE id = $1 
            `,[user_id])
            const email = result.rows[0].email;
            const subject = `VarsitySteps Premium Payment Not Approved`
            const emailmessage = `You payment for VarsitySteps Premium has not been approved.\n\n
            This is due to insufficient funds and or an unclear proof of payment file or image\n\n
            Kindly topup the remaining amount or send a clear image of proof of payment\n
            Thank you
            VarsitySteps
            `
            await sendMail(email,subject,emailmessage)  
            res.status(200).json({message:'email user denied'})
        }
        
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'Internal server error'})
    }
}