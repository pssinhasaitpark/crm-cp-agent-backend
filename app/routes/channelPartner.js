//app/routes/channelPartner.js
import express from "express";
import { channelPartner } from "../controllers/channelPartner.js";
import { verifyToken } from "../middlewares/jwtAuth.js";
import { upload,uploadFilesToCloudinary } from "../middlewares/multer.js";

const router = express.Router();

//Admin creates channel partner (protected)
router.post("/admin/create", verifyToken, upload, channelPartner.createChannelPartner);

//Self-registration (no token required)
router.post("/sign-up", upload, channelPartner.createChannelPartner);

router.post("/login", channelPartner.loginChannelPartner);

router.get("/", verifyToken, channelPartner.getAllChannelPartners);

router.get("/:id", verifyToken, channelPartner.getChannelPartnerById);

router.delete("/:id", verifyToken, channelPartner.deleteChannelPartnerById);

export default router;