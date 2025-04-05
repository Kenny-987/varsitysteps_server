import { Server as HttpServer } from "http";
import { Request, Response} from 'express';
import { Server } from "socket.io";
import { chatSockets } from "../controllers/messagesController";
import { videoCall } from "../controllers/videoCallController";
import { client } from "./connect";
// import { requestSockets } from "../controllers/requestController";
// import { setupCallSockets } from "./callSockets";

let io: Server | null = null; // Store the socket instance
export const onlineUsers: Record<string, string> = {}
export const initializeSocket = (server: HttpServer) => {
  try {
    io = new Server(server, {
      cors: {
        origin: "https://www.varsitysteps.co.zw",
        methods: ["GET", "POST", "OPTIONS", "PATCH", "PUT"],
        credentials: true,
      },
    });

    console.log("Socket.io initialized"); 

    io.on("connection",async (socket) => {
      console.log("User connected:", socket.id);
      const userId = socket.handshake.query.userId; // Retrieve userId from query
      if (userId) {
          onlineUsers[Number(userId)] = socket.id;
          await client.query(`UPDATE users SET is_online = true WHERE id =$1`,[userId])
          console.log(`User ${userId} registered with socket ID: ${socket.id}`); 
      }
      // Attach feature-specific socket handlers
      chatSockets(io!, socket);
      videoCall(io!,socket)
    //   requestSockets(io!,socket)
    //   setupCallSockets(io, socket);

    socket.on("disconnect", async() => {
        for (const userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                delete onlineUsers[userId];
                await client.query(`
                  UPDATE users SET last_active = CURRENT_TIMESTAMP, is_online = false WHERE id = $1
                  `,[userId])
                console.log(`User ${userId} disconnected`);
                break;
            }
        }
    });
    });
  } catch (error) {
    console.error("Socket Initialization Error:", error);
  }
};

// Function to get io instance
export const getSocketInstance = (): Server => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
