import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { chatSockets } from "../controllers/messagesController";
import { videoCall } from "../controllers/videoCallController";
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

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);
      socket.on("register", ({userId}: any) => {
        onlineUsers[userId] = socket.id; // Store userId -> socketId
        console.log(`User ${userId} registered with socket ID: ${socket.id}`);
    });
      // Attach feature-specific socket handlers
      chatSockets(io!, socket);
      videoCall(io!,socket)
    //   requestSockets(io!,socket)
    //   setupCallSockets(io, socket);

    socket.on("disconnect", () => {
        for (const userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                delete onlineUsers[userId];
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
