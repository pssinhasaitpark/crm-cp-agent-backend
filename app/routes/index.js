//app/routes/index.js
import userRoutes from "./user.js";
import channelPartnerRoutes from "./channelPartner.js";
import agentRoutes from "./agent.js";
import leadRoutes from "./leads.js";
import masterStatusRoutes from "./masterStatus.js";
import customerRoutes from "./customers.js";
import projectRoutes from "./projects.js";

const setupRoutes = (app, io) => {
    app.use("/api/v1/admin", userRoutes);
    app.use("/api/v1/channel-partner", channelPartnerRoutes);
    app.use("/api/v1/agent", agentRoutes);
    // app.use("/api/v1/leads",leadRoutes);
    app.use("/api/v1/leads", leadRoutes(io));
    app.use("/api/v1/master-status", masterStatusRoutes);
    app.use("/api/v1/customers", customerRoutes);
    app.use("/api/v1/projects", projectRoutes);
};

export default setupRoutes;