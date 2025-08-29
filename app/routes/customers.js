// app/routes/customer.js
import express from "express";
import { customers } from "../controllers/customers.js";
import { verifyToken } from "../middlewares/jwtAuth.js";

const router = express.Router();

router.post("/create", verifyToken, customers.createCustomer);

router.get("/admin", verifyToken, customers.getAllCustomersForAdmin);

router.get("/channel-partner", verifyToken, customers.getAllCustomersForChannelPartner);

router.get("/agent", verifyToken, customers.getAllCustomersForAgent);

export default router;
