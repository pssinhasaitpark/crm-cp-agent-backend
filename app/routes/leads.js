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

// router.patch("/:id", verifyToken, leads.updateLeadStatusById);

router.patch("/:id", verifyToken, leads.updateLeadStatus);
router.patch("/admin/:id", verifyToken, leads.updateLeadStatusByAdmin);
router.patch("/agent/:id", verifyToken, leads.updateLeadStatusByAgent);
router.patch("/channel-partner/:id", verifyToken, leads.updateLeadStatusByChannelPartner);


export default router;