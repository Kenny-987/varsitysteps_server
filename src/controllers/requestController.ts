// this controller is for updating requests and notification data for tutors and users
import { Request, Response } from 'express';
import { client } from '../services/connect';
import { sendMail } from '../services/mail';
import { getSocketInstance,onlineUsers } from '../services/socket';
import { Server,Socket } from 'socket.io'



// export const requestSockets =(io: Server, socket: Socket)=>{
   
//     const tutorSocke
//     socket.on('request',(data)=>{
//     })
// }

export async function connectionRequest(req: Request, res: Response) {
    if(req.isAuthenticated()){
        const{student_id,tutor_id} = req.body
        const io = getSocketInstance()
        const tutorSocketId = onlineUsers[tutor_id]
        try {
            const existingRequest = await client.query(`
            SELECT * FROM connections WHERE student_id = $1 AND tutor_id = $2 AND status = $3
            `,[student_id,tutor_id,'pending'])
            if(existingRequest.rows.length > 0){
            return res.status(400).json({message:'A request has already been sent'})
            } 

            //fetching student details
            const studentDetails = await client.query(`SELECT users.username
                FROM users 
                WHERE users.id = $1`,[student_id])
            
                if (studentDetails.rows.length === 0) {
                    return res.status(404).json({ message: 'Student not found' });
                }

            await client.query(`
                INSERT INTO connections (student_id,tutor_id) VALUES ($1, $2)
                `,[student_id,tutor_id])
            
            
            ///// funtionality to send email notifications on request
            //get tutor email
            const email = await client.query(`SELECT email FROM users WHERE id=$1`,[tutor_id])
            const subject = `New VarsitySteps connection request.`
            const message = `You have recieved a new connection request from ${studentDetails.rows[0].username}. \n Visit your dashboard to accept the student: https://varsitysteps.co.zw/dashboard`

            if(email.rows.length>0){
                try {
                    await sendMail(email.rows[0].email, subject, message);
                } catch (emailError) {
                    console.error("Error sending email:", emailError);
                    return res.status(200).json({ message: "Request sent, but email notification failed" });
                }
            }
            if(tutorSocketId){
                io.to(tutorSocketId).emit('notification',{
                    message:`You have received a new connection request from a student: ${studentDetails.rows[0].username}`
                })
                io.to(tutorSocketId).emit('requests',{
                    message:'refreshing requests'
                })
            }
                res.status(200).json({message:'request sent'})
            
          
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
            
            if(result.rows.length >0){
                const status = result.rows[0].status
                if(status === 'connected'){
                    res.status(200).json({isconnected: true, status:'connected'})
                }else if (status === 'pending'){
                    res.status(200).json({isconnected: false, status:'pending'})
                }    
            }else{
            res.status(200).json({isconnected: false,status:'not connected'})
            }
        } catch (error) {
            console.error(error)
        }
        
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
            const student_id = response.rows[0].student_id
            const studentSocketId = onlineUsers[student_id]
            const io = getSocketInstance()
            try {
                const existingChat = await client.query(
                    `SELECT c.id FROM chats c
                     JOIN participants p1 ON c.id = p1.chat_id
                     JOIN participants p2 ON c.id = p2.chat_id
                     WHERE p1.user_id = $1 AND p2.user_id = $2`,
                    [responder_id, student_id])

                    let chatId;
                    if (existingChat.rows.length==0) {
                      // If chat exists, use that chat ID
                      const newChat = await client.query(
                        `INSERT INTO chats (created_at, updated_at)
                         VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                         RETURNING id`
                      );
                      chatId = newChat.rows[0].id;
                    }
                    await client.query(
                        `INSERT INTO participants (chat_id, user_id)
                         VALUES ($1, $2), ($1, $3)`,
                        [chatId, responder_id, student_id]
                      );
            } catch (error) {
                console.error(error)
            }
            if(studentSocketId){
                io.to(studentSocketId).emit('notification',{
                    message:`${responder.rows[0].username} has accepted your request`
                })
            }
            const message = `${responder.rows[0].username} accepted your connection request`
            const type = 'response'
            const extra_info = JSON.stringify({responder_id})
            await client.query(`INSERT INTO notifications(user_id,message,type,extra_info) VALUES ($1,$2,$3,$4)`,[student_id,message,type,extra_info])  

            const email = await client.query(`SELECT email FROM users WHERE id=$1`,[student_id])
            const subject = `A tutor has accepted your connection request on VarsitySteps`
            const emailmessage = `${responder.rows[0].username} accepted your connection request. /n Visit your dashboard and start chatting with your tutors: https://varsitysteps.co.zw/dashboard`
            
            if(email.rows.length>0){
                    try {
                        await sendMail(email.rows[0].email, subject, emailmessage);
                    } catch (emailError) {
                        console.error("Error sending email:", emailError);
                        return res.status(200).json({ message: "Request sent, but email notification failed" });
                    }
              }
                res.status(200).json({message:'request accepted'})
              
             
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