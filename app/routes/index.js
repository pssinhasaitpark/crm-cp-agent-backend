//app/routes/index.js
import userRoutes from "./user.js";
import channelPartnerRoutes from "./channelPartner.js";
import agentRoutes from "./agent.js";
import leadRoutes from "./leads.js";

const setupRoutes = (app) => {
    app.use("/api/v1/admin", userRoutes);
    app.use("/api/v1/channel-partner", channelPartnerRoutes);
    app.use("/api/v1/agent", agentRoutes);
    app.use("/api/v1/leads",leadRoutes)
};

export default setupRoutes;