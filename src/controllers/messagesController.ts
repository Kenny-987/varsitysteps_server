import { Request, Response} from 'express';
import { client } from '../services/connect';
import { Server,Socket } from 'socket.io'
import { onlineUsers } from '../services/socket';


export const chatSockets = (io: Server, socket: Socket)=>{

  socket.on('joinRoom', (chat_id:any) => {
    socket.join(chat_id);
  });
  socket.on('joinGroup',(chat_id:any)=>{
    socket.join(chat_id)
    console.log('user joined group');
    
  })
socket.on('chatMessage',async(data:any)=>{
    const {sender_id,message,receiver_id,chat_id,sender_name}= data
    
    try {
        const result = await client.query(` 
            INSERT INTO messages (chat_id, sender_id, message,sender_name) VALUES($1, $2, $3,$4) 
            RETURNING *`, [chat_id, sender_id, message,sender_name]
        );    
        if (result.rows.length > 0) {
         
            io.to(chat_id).emit("chatMessage", data);
              const receiverSocketId = onlineUsers[receiver_id];
              if (receiverSocketId) {
                io.to(receiverSocketId).emit('notification', {
                  message: `New message from ${sender_name}`,
                });
              }
        }
    } catch (error) {
        console.error(error)
        socket.emit("errorMessage", { error: "Failed to send message" });
    } 
})
socket.on('groupMessage', async (data: any) => {
    const { sender_id, message, chat_id,sender_name } = data;
console.log(data);

    try {
      const result = await client.query(
        `INSERT INTO messages (chat_id, sender_id, message,sender_name) VALUES($1, $2, $3,$4) RETURNING *`,
        [chat_id, sender_id, message,sender_name]
      );

      if (result.rows.length > 0) {
        io.to(chat_id).emit("groupMessage", data); // Emit only for group chats
      }
    } catch (error) {
      console.error(error);
      socket.emit("errorMessage", { error: "Failed to send group message" });
    }
  });
}
       


//function to get chats
export async function getChats(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const user_id  = req.user?.id
        try{
            const chats = await client.query(
                `SELECT 
    c.id AS chat_id,c.is_group,
    u.id AS recipient_id,
    u.is_online,
    u.last_active,
    u.username AS recipient_name,
    u.profile_image AS recipient_profile_image,
    m.message AS last_message,
    m.sent_at AS last_message_time
FROM chats c
-- Get the recipient (other user in a one-on-one chat)
JOIN participants p1 ON c.id = p1.chat_id
JOIN participants p2 ON c.id = p2.chat_id AND p1.user_id != p2.user_id
JOIN users u ON u.id = p2.user_id
-- Get the last message (subquery to fetch the most recent message)
LEFT JOIN messages m ON c.id = m.chat_id AND m.sent_at = (
    SELECT MAX(sent_at) 
    FROM messages 
    WHERE chat_id = c.id
)
WHERE p1.user_id = $1
AND c.is_group =FALSE  -- The current user
ORDER BY m.sent_at DESC;
`
            ,[user_id])
        
        const group_chat = await client.query(
            `SELECT 
    c.id AS chat_id, 
    c.is_group,
    c.name AS group_name,  
    NULL AS chat_display_image, -- No profile image for groups
    m.message AS last_message,
    m.sender_name,
    m.sent_at AS last_message_time,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'participant_id', u.id,
            'participant_name', u.username,
            'participant_profile_image', u.profile_image
        )
    ) AS participants
FROM chats c
LEFT JOIN messages m 
    ON c.id = m.chat_id 
    AND m.sent_at = (SELECT MAX(sent_at) FROM messages WHERE chat_id = c.id)
JOIN participants p ON c.id = p.chat_id
JOIN users u ON p.user_id = u.id  -- Get participant details
WHERE p.user_id = $1 
AND c.is_group = TRUE -- Only fetch group chats for the current user
GROUP BY c.id, c.is_group, c.name, m.message, m.sent_at,m.sender_name
ORDER BY m.sent_at DESC;
`,[user_id]
         )
        const allChats = [...chats.rows,...group_chat.rows]
            res.status(200).json(allChats)
        }catch(error){
            console.error('error at chats:' ,error)
            res.status(500).json({msg:'server error'})
        }

    }else{
        return res.status(401).json({msg:"No access please login"})
    }
}



// function to get messages
export async function getMessages(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const chat_id  = req.params.chat_id
        
        try {
        
            const messages = await client.query(
                `SELECT * FROM messages WHERE chat_id = $1 ORDER BY sent_at`,
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