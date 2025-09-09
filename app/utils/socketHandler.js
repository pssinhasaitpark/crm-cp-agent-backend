//app/utils/socketHandler.js
import Chat from "../models/chat.js";  

export const initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 New client connected:", socket.id);

    socket.on("join-agent", ({ agentId }) => {
      if (!agentId) return;
      console.log(`Agent ${agentId} joined room with socket ${socket.id}`);
      socket.join(agentId);
    });

    socket.on("join-admin", ({ adminId }) => {
      socket.join("admins"); 
      console.log(`Admin joined: ${adminId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });

    socket.on("send-message", async ({ senderId, receiverId, message, senderRole }) => {
      const payload = {
        senderId,
        receiverId,
        message,
        senderRole,
        timestamp: new Date(),
      };

      try {
        const chat = new Chat({
          senderId,
          receiverId,
          message,
          senderRole,
        });

        await chat.save();
        console.log("Message saved to DB");
      } catch (err) {
        console.error("Error saving message:", err.message);
      }

      if (senderRole === "agent" || senderRole === "channel_partner") {
        io.to("admins").emit("receive-message", payload);
      } else if (senderRole === "admin") {
        io.to(receiverId).emit("receive-message", payload);
      }

      console.log("Message sent:", payload);
    });
  });
};
