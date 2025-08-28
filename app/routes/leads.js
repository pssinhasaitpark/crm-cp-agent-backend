//app/routes/leads.js
import express from "express";
import { leads } from "../controllers/leads.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/", verifyToken, leads.createLead);

export default router;