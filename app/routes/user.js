//app/routes/user.js
import express from "express";
import { admin } from "../controllers/user.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/signup", admin.createAdmin);

router.post("/login", admin.loginAdmin)

router.patch("/:id", verifyToken, admin.approveUserStatusById);

router.get("/me", verifyToken, admin.me);

export default router;
