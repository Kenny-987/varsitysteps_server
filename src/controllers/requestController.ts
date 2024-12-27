// this controller is for updating requests and notification data for tutors and users
import { Request, Response } from 'express';
import { client } from '../services/connect';
import { sendMail } from '../services/mail';


export async function connectionRequest(req: Request, res: Response) {
    if(req.isAuthenticated()){
        const{student_id,tutor_id} = req.body
        console.log(student_id,tutor_id)
        try {
            const existingRequest = await client.query(`
            SELECT * FROM connections WHERE student_id = $1 AND tutor_id = $2 AND status = $3
            `,[student_id,tutor_id,'pending'])
            if(existingRequest.rows.length > 0){
            return res.status(400).json({message:'A request has already been sent'})
            } 

            //fetching student details
            const studentDetails = await client.query(`SELECT users.username, users.location, students.programme, students.institution 
                FROM users 
                LEFT JOIN students ON students.user_id = users.id
                WHERE users.id = $1`,[student_id])
            
                if (studentDetails.rows.length === 0) {
                    return res.status(404).json({ message: 'Student not found' });
                }

            await client.query(`
                INSERT INTO connections (student_id,tutor_id) VALUES ($1, $2)
                `,[student_id,tutor_id])
            
            ///// funtionality to send email notifications on request
            //get tutor email
            const email = await client.query(`SELECT email FROM users WHERE id=$1 AND is_verified = true`,[tutor_id])
            console.log(email);
            
            const subject = `New VarsitySteps connection request.`
            const message = `You have recieved a new connection request from ${studentDetails.rows[0].username}. \n Visit your dashboard to accept the student: https:varsitysteps.vercel.app/dashboard`

            if(email.rows.length>0){
              return  sendMail(email.rows[0].email,subject,message,res)
            }
          
            
            res.status(200).json({message:'requets sent'})
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'error sending request'})
        }
    }else{
        return res.status(401).json({msg:"No access please login"})
    }
    
}

export async function getRequets(req: Request, res: Response){
    const {reciever_id} = req.params

    if(req.isAuthenticated()){
        try {
            const requests =  await client.query(`SELECT connections.connection_id, connections.student_id, connections.tutor_id,
                connections.status, users.username
                FROM connections
                LEFT JOIN users on users.id = connections.student_id
                WHERE connections.tutor_id = $1 AND connections.status = 'pending' `,[reciever_id]) 
             
           if (requests.rows.length > 0){
               res.status(200).json(requests.rows)
           }
            
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'Internal server error'})
        }
        
        
    }else{
        return res.status(401).json({msg:"No access please login"})
    }

}
export async function checkConnection(req: Request, res: Response) {
    const {student_id,tutor_id} = req.body
    if(req.isAuthenticated()){
        try {
            const result = await client.query(`
                SELECT status
                FROM connections
                WHERE (student_id = $1 AND tutor_id = $2)
                OR (student_id = $2 AND tutor_id = $1)
                `,[student_id,tutor_id])
            console.log(result.rows[0].status)
            if(result.rows.length >0){
                const status = result.rows[0].status
                if(status === 'connected'){
                    res.status(200).json({isconnected: true, status:'connected'})
                }else if (status === 'pending'){
                    res.status(200).json({isconnected: false, status:'pending'})
                }else{
                res.status(200).json({isconnected: false,status:'not connected'})
                }
            } else{
                res.status(404).json({message:'no connection'})
            }
              
        } catch (error) {
            console.error(error)
        }
        
    }else{
        return res.status(401).json({msg:"No access please login"})
    }


}


export async function connectionResponse(req: Request, res: Response) {
    if(req.isAuthenticated()){
    const {requestId} = req.params
    const {status} = req.body
    try {
        const response =await client.query(`UPDATE connections SET status = $1 WHERE connections.connection_id = $2 RETURNING *`,[status,requestId])

        if(response){
            //GET TUTOR NAME
            const responder_id = req.user?.id
            const responder = await client.query(`SELECT username,id FROM users WHERE id = $1`,[req.user?.id])

            const user_id = response.rows[0].student_id
            const message = `${responder.rows[0].username} accepted your connection request`
            const type = 'response'
            const extra_info = JSON.stringify({responder_id})
            await client.query(`INSERT INTO notifications(user_id,message,type,extra_info) VALUES ($1,$2,$3,$4)`,[user_id,message,type,extra_info])  

            const email = await client.query(`SELECT email FROM users WHERE id=$1 AND is_verified = true`,[user_id])
            const subject = `A tutor has accepted your connection request on VarsitySteps`
            const emailmessage = `${responder.rows[0].username} accepted your connection request. /n Visit your dashboard and start chatting with your tutors: https://varsitysteps.vercel.app/dashboard`

            sendMail(email.rows[0].email,subject,emailmessage,res)
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({ error });
    }
    }else{
        return res.status(204).json({msg:"No access please login"})
    }
}
export async function getNotifications(req: Request, res: Response) {
    if(req.isAuthenticated()){
        const user_id= req.user?.id
        try {
            const query = await client.query(`
                SELECT * FROM notifications
                WHERE user_id = $1`,[user_id])
            const notifications  =  query.rows
                res.status(200).json(notifications)
        } catch (error) {
            
        }
    }
}

export async function markAsRead(req: Request, res: Response) {
    if(req.isAuthenticated()){
        try {
            const{status} =req.body
            const result = await client.query(`UPDATE notifications SET is_read = $1`,[status])
            res.status(200).json({msg:'updated'})
        } catch (error) {
            console.error(error)
            res.status(500)
        }
        
    }
}