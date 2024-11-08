import { Request, Response, NextFunction } from 'express';
import { client } from '../services/connect';
import { Server } from 'socket.io'


let io:any;
export const initializeSocket = (server:any)=>{
    try { 
        io = new Server(server, {
            cors: {
              origin: 'https://varsitysteps.vercel.app', 
              methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT'],
              credentials: true,
            },
          });
          io.on('connection',(socket:any)=>{
            socket.on('joinRoom', (userId:any) => {
                socket.join(userId);
              });
            socket.on('chatMessage',async(data:any)=>{
                const {sender_id,message,receiver_id}= data
                console.log('incoming data: ',data)
                const checkChat = await client.query(`SELECT * FROM chats 
                    WHERE user_1 = $1 AND user_2 = $2
                    OR user_1 = $2 AND user_2 = $1`,
                   [sender_id,receiver_id]
                  )
                  let chatId;
        
                  if(checkChat.rows.length === 0){
                   const newChat = await client.query(`
                      INSERT INTO chats(user_1,user_2) VALUES ($1, $2) RETURNING chat_id`,[sender_id,receiver_id])
                    chatId = newChat.rows[0].chat_id
                    }else{
                         chatId=checkChat.rows[0].chat_id
                     }
                     await client.query(` 
                   INSERT INTO messages (chat_id,sender_id,receiver_id, message) VALUES($1,$2,$3,$4)`,
                [chatId,sender_id,receiver_id,message])     
        
                console.log('this is data', data)
                socket.to(receiver_id).emit('chatMessage', data);
    
          // Optionally, send the message back to the sender
          socket.emit('chatMessage', data);
            })
            socket.on('disconnect',()=>{ 
                console.log('user disconnected',socket.id)
            })
        })
    } catch (error) {
        console.error(error)
    }
}

export const getSocketInstance = ()=>io

//function to send messages
export async function sendMessages(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const { receiver_id,sender_id, message} = req.body
        
        try {
            //checking if chat already exists
            const checkChat = await client.query(`SELECT * FROM chats 
                WHERE user_1 = $1 AND user_2 = $2
                OR user_1 = $2 AND user_2 = $1`,
                [sender_id,receiver_id]
            )
            let chatId;

            if(checkChat.rows.length === 0){
                const newChat = await client.query(`
                    INSERT INTO chats(user_1,user_2) VALUES ($1, $2) RETURNING chat_id`,[sender_id,receiver_id])
                chatId = newChat.rows[0].chat_id
            }else{
                chatId=checkChat.rows[0].chat_id
            }

            const content = await client.query(`
                INSERT INTO messages (chat_id,sender_id, content) VALUES($1,$2,$3) RETURNING *`,
            [chatId,sender_id,message])
            console.log(content)
            res.status(201).json(content.rows[0])
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'error'})
        }
    }else{
        return res.status(401).json({msg:"No access please login"})
    }

}


//function to get chats
export async function getChats(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const user_id  = req.user?.id
        try{
            const chats = await client.query(
                `SELECT 
                    chats.chat_id, 
                    chats.user_1,
                    chats.user_2,
                    CASE 
                WHEN chats.user_1 = $1 THEN users2.profile_image
                ELSE users1.profile_image
                END AS profile_image,
                CASE	
                WHEN chats.user_1 = $1 THEN users2.username
                ELSE users1.username
                END AS person_2,
                last_message.message AS last_message_content,
                last_message.timestamp AS last_message_time
                FROM CHATS
                LEFT JOIN users users1 ON chats.user_1 = users1.id
                LEFT JOIN users users2 ON chats.user_2 = users2.id
                -- Subquery to get the last message per chat
                LEFT JOIN (
                    SELECT chat_id, message, timestamp
                    FROM messages
                    WHERE (chat_id, timestamp) IN (
                        SELECT chat_id, MAX(timestamp)
                        FROM messages
                        GROUP BY chat_id
                    )
                ) AS last_message ON last_message.chat_id = chats.chat_id
                WHERE chats.user_1 = $1 OR chats.user_2 = $1
                ORDER BY chats.created_at DESC;`
            ,[user_id])
            
            res.status(200).json(chats.rows)
        }catch(error){
            console.error('error at chats:' ,error)
            res.status(500).json({msg:'server error'})
        }

    }else{
        return res.status(401).json({msg:"No access please login"})
    }
}


//function to check chats between two people
export async function checkChat(req:Request,res:Response) {
    console.log('hit the check chat api');
    
    if(req.isAuthenticated()){  
        try {
            const user1 = req.query.user1
            const user2 = req.query.user2
            console.log('these are users: ',user1,user2)
        let chatsExist:boolean
        const result = await client.query(`
            select * from chats
             WHERE (user_1= $1 AND user_2 = $2)
             OR (user_1 = $2 AND user_2 = $1)`,[user2,user1])

        if(result.rows.length === 0){
            chatsExist = false
        }else{
            chatsExist = true
            console.log('chat exists');
        }
        res.status(200).json(chatsExist)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:"Internal Server error"})
        }
        
    }else{
        return res.status(401).json({msg:"No access please login"})
    }
}

// function to get messages
export async function getMessages(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const chat_id  = req.params.chat_id
        console.log(chat_id)
        try {
        
            const messages = await client.query(
                `SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp`,
            [chat_id])
            res.status(200).json(messages.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({msg:'server error'})
        }
        

    }else{
        return res.status(401).json({msg:"No access please login"})
    }

}  