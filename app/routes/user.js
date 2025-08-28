//app/routes/user.js
import express from "express";
import { admin } from "../controllers/user.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/signup", admin.createAdmin);

router.post("/login", admin.loginAdmin)

router.get("/", verifyToken, admin.getAllChannelPartners);

router.get("/:id", verifyToken, admin.getChannelPartnerById);

router.patch("/:id", verifyToken, admin.approveChannelPartnerStatusById);

router.delete("/channel-partner/:id", verifyToken, admin.deleteChannelPartnerById);

export default router;
