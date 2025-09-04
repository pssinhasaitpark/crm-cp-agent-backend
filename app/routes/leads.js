// //app/routes/leads.js
// import express from "express";
// import { leads } from "../controllers/leads.js";
// import { verifyToken } from "../middlewares/jwtAuth.js";

// const router = express.Router();

// router.post("/", verifyToken, leads.createLead);

// router.get("/admin", verifyToken, leads.getAllLeadsForAdmin);

// router.get("/channel-partner", verifyToken, leads.getAllLeadsForChannelPartner);

// router.get("/agent", verifyToken, leads.getAllLeadsForAgent);

// router.get("/:id", verifyToken, leads.getLeadById);

// // router.patch("/:id", verifyToken, leads.updateLeadStatusById);

// router.patch("/:id", verifyToken, leads.updateLeadStatus);
// router.patch("/admin/:id", verifyToken, leads.updateLeadStatusByAdmin);
// router.patch("/agent/:id", verifyToken, leads.updateLeadStatusByAgent);
// router.patch("/channel-partner/:id", verifyToken, leads.updateLeadStatusByChannelPartner);

// router.get("/admin/:agentId", verifyToken, leads.getLeadDetailsByAgentId);

// router.post("/accept/:leadId", verifyToken, leads.acceptLead);
// router.post("/decline/:leadId", verifyToken, leads.declineLead);

// export default router;

import express from "express";
import { leads } from "../controllers/leads.js";
import { verifyToken } from "../middlewares/jwtAuth.js";
import { attachSocket } from "../middlewares/attachSocket.js";

const router = express.Router();

export default function (io) {
  router.use(attachSocket(io));

  router.post("/", verifyToken, leads.createLead);

  router.get("/admin", verifyToken, leads.getAllLeadsForAdmin);
  router.get("/channel-partner", verifyToken, leads.getAllLeadsForChannelPartner);
  router.get("/agent", verifyToken, leads.getAllLeadsForAgent);
  router.get("/:id", verifyToken, leads.getLeadById);

  // 🧼 REFACTORED PATCH ROUTES
  router.patch("/:id", verifyToken, leads.updateLeadStatusByAgent);
  router.patch("/admin/:id", verifyToken, leads.updateLeadStatusByAdmin);
  router.patch("/agent/:id", verifyToken, leads.updateLeadStatusByAgent);
  router.patch("/channel-partner/:id", verifyToken, leads.updateLeadStatusByChannelPartner);

  router.get("/admin/:agentId", verifyToken, leads.getLeadDetailsByAgentId);

  router.post("/accept/:leadId", verifyToken, leads.acceptLead);
  router.post("/decline/:leadId", verifyToken, leads.declineLead);

  return router;
}



/* correct 
import express from "express";
import { leads } from "../controllers/leads.js";
import { verifyToken } from "../middlewares/jwtAuth.js";
import { attachSocket } from "../middlewares/attachSocket.js"; // <- new middleware

const router = express.Router();

export default function (io) {
  // Attach io to every request
  router.use(attachSocket(io));

  router.post("/", verifyToken, leads.createLead);

  router.get("/admin", verifyToken, leads.getAllLeadsForAdmin);
  router.get("/channel-partner", verifyToken, leads.getAllLeadsForChannelPartner);
  router.get("/agent", verifyToken, leads.getAllLeadsForAgent);
  router.get("/:id", verifyToken, leads.getLeadById);

  router.patch("/:id", verifyToken, (req, res) =>
    leads.updateLeadStatus({ req, res, allowedRole: "agent", io })
  );
  router.patch("/admin/:id", verifyToken, (req, res) =>
    leads.updateLeadStatus({ req, res, allowedRole: "admin", io })
  );
  router.patch("/agent/:id", verifyToken, (req, res) =>
    leads.updateLeadStatus({ req, res, allowedRole: "agent", io })
  );
  router.patch("/channel-partner/:id", verifyToken, (req, res) =>
    leads.updateLeadStatus({ req, res, allowedRole: "channel_partner", io })
  );

  router.get("/admin/:agentId", verifyToken, leads.getLeadDetailsByAgentId);

  // ✅ now works with req.io
  router.post("/accept/:leadId", verifyToken, leads.acceptLead);
  router.post("/decline/:leadId", verifyToken, leads.declineLead);

  return router;
}
*/