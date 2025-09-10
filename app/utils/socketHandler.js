//app/utils/socketHandler.js

//09 Sep 2025,  status & last seen not manage here
/*
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
*/

//app/utils/socketHandler.js
//10 Sep 2025,  status & last seen manage here
import Chat from "../models/chat.js";
import Agent from "../models/agent.js";

export const initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 New client connected:", socket.id);

    let connectedAgentId = null;

    // Agent joins
    socket.on("join-agent", async ({ agentId }) => {
      if (!agentId) return;
      console.log(`Agent ${agentId} joined room with socket ${socket.id}`);
      socket.join(agentId);
      connectedAgentId = agentId;

      // Set last_seen to null (means online)
      try {
        await Agent.findByIdAndUpdate(agentId, { last_seen: null });
        console.log(`Agent ${agentId} marked as online`);
      } catch (err) {
        console.error("Error setting agent online:", err.message);
      }
    });

    // Admin joins (same as before)
    socket.on("join-admin", ({ adminId }) => {
      socket.join("admins");
      console.log(`Admin joined: ${adminId}`);
    });

    // Handle message sending (same as before)
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

    // When agent disconnects
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);
      if (connectedAgentId) {
        try {
          await Agent.findByIdAndUpdate(connectedAgentId, { last_seen: new Date() });
          console.log(`Agent ${connectedAgentId} marked as offline at ${new Date()}`);
        } catch (err) {
          console.error("Error setting last_seen on disconnect:", err.message);
        }
      }
    });
  });
};
