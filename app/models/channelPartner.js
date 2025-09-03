// //app/models/channelPartner.js
import mongoose from "mongoose";

const channelPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    mobile_number: { type: String, required: true },
    state: { type: String, required: true },
    firm_name: { type: String, required: true },
    reraId: { type: String },
    // agent_type: { type: String, enum: ["agent", "channel_partner"], default: "channel_partner" },
    role: { type: String, enum: ["agent", "channel_partner"], default: "channel_partner" },
    year_of_experience: { type: Number, required: true },
    profile_photo: { type: String, required: true },
    id_proof: { type: String, required: true },
    referral_code: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ChannelPartner", channelPartnerSchema);