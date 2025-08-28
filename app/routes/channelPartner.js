//app/routes/channelPartner.js
import express from "express";
import { channelPartner } from "../controllers/channelPartner.js";
import { verifyToken } from "../middlewares/jwtAuth.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

// ✅ Admin creates channel partner (protected)
router.post("/admin/create", verifyToken, upload, channelPartner.createChannelPartner);

// ✅ Self-registration (no token required)
router.post("/sign-up", upload, channelPartner.createChannelPartner);

router.post("/login", channelPartner.loginChannelPartner);

export default router;