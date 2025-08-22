//app/routes/index.js
import userRoutes from "./user.js";
import channelPartnerRoutes from "./channelPartner.js";

const setupRoutes = (app) => {
    app.use("/api/v1/admin", userRoutes);
    app.use("/api/v1/channel-partner", channelPartnerRoutes);
};

export default setupRoutes;