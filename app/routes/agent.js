// app/routes/agentRoutes.js
import express from "express";
import { agent } from "../controllers/agent.js";
import { upload } from "../middlewares/multer.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

// Public registration
router.post("/register", upload, agent.createAgent);

// If you want admin-only creation
router.post("/create", verifyToken, upload, agent.createAgent);

router.post("/login", agent.loginAgent);

router.get("/", verifyToken, agent.getAllAgents);

router.get("/channel-partner", verifyToken, agent.getAllAgentsForChannelPartner);

router.get("/agent/:id", verifyToken, agent.getAgentById);

router.delete("/:id", verifyToken, agent.deleteAgentById);

export default router;
