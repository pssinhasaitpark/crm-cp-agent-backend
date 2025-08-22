//app/routes/channelPartner.js
import express from "express";
import { channelPartner } from "../controllers/channelPartner.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/", verifyToken, channelPartner.createChannelPartner);

router.post("/login", channelPartner.loginChannelPartner);

export default router;