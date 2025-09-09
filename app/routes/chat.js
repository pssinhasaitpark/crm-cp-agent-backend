// app/routes/chatRoutes.js
import express from "express";
import { chats } from "../controllers/chat.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/create/:receiverId", verifyToken, chats.createChat);

router.get("/history", verifyToken, chats.getAllChatHistory);

router.get("/history/:userId", verifyToken, chats.getChatHistoryOfAgentCPById);

router.get("/participants", verifyToken, chats.getAllChatParticipantsWithLastMessage);

export default router;
