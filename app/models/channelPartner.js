//app/models/channelPartner.js
import mongoose from "mongoose";

const channelPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    mobile_number: { type: String, required: true },
    role: { type: String, default: "channel_partner" },
  },
  { timestamps: true }
);

export default mongoose.model("ChannelPartner", channelPartnerSchema);