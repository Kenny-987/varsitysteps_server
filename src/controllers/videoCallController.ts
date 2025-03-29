import { Request, Response} from 'express';
import { client } from '../services/connect';
import { Server,Socket } from 'socket.io'
import { onlineUsers } from '../services/socket';

export const videoCall =(io: Server, socket: Socket)=>{

   socket.on('call-user', (data: { toUserId: string; fromUserId: string; offer: RTCSessionDescriptionInit,callerName:string }) => {
    const targetSocketId = onlineUsers[data.toUserId];

   
   
    if (targetSocketId) {
    io.to(targetSocketId).emit('calling-user',{
        offer: data.offer,
        callerUserId: data.fromUserId,
        callerName:data.callerName
    })
      io.to(targetSocketId).emit('call-made', {
        offer: data.offer,
        callerUserId: data.fromUserId,
        callerName:data.callerName
      });
    } else {
      const callerSocketId = onlineUsers[data.fromUserId];
      if(callerSocketId)
       io.to(callerSocketId).emit('user-offline', {
        message:'user offline'
      });
    }
  });

socket.on('cancel-call',(data:{ toUserId: string; fromUserId: string})=>{
    const targetSocketId = onlineUsers[data.toUserId];
    const callerSocketId = onlineUsers[data.fromUserId];
    console.log('call is being cancelled');
    
    if (targetSocketId) {
        io.to(targetSocketId).emit('call-cancelled', {
          message:'call cancelled'
        });
        io.to(callerSocketId).emit('call-cancelled', {
          message:'you cancelled'
        });
      }
  })


    socket.on('make-answer', (data: { toUserId: string; fromUserId: string; answer: RTCSessionDescriptionInit }) => {
    const targetSocketId = onlineUsers[data.toUserId];
    const callerSocketId = onlineUsers[data.fromUserId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer-made', {
        answer: data.answer,
        responderUserId: data.fromUserId,
      });
      io.to(callerSocketId).emit('answer-made', {
        answererId: data.fromUserId,
        message: 'call answered',
      });
    }
  });

  socket.on('end-call',(data)=>{
    console.log('user ending call');
    
    const targetSocketId = onlineUsers[data.toUserId];
    console.log(targetSocketId);
    
    const callerSocketId = onlineUsers[data.fromUserId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended', {
        message:'call ended'
      });
      io.to(callerSocketId).emit('call-ended', {
        message:'you ended call'
      });
    }
  })
    socket.on('ice-candidate', (data: { toUserId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
    
    const targetSocketId = onlineUsers[data.toUserId];
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate: data.candidate,
        fromUserId: data.fromUserId,
      });
    }
  });
            
}