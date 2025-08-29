//app/routes/leads.js
import express from "express";
import { leads } from "../controllers/leads.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/", verifyToken, leads.createLead);

router.get("/admin", verifyToken, leads.getAllLeadsForAdmin);

router.get("/channel-partner", verifyToken, leads.getAllLeadsForChannelPartner);

router.get("/agent", verifyToken, leads.getAllLeadsForAgent);

router.get("/:id", verifyToken, leads.getLeadById);

export default router;