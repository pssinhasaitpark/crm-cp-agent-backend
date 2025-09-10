// app/models/agent.js
import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    mobile_number: { type: String, required: true },
    state: { type: String, required: true },
    firm_name: { type: String, required: true },
    reraId: { type: String },
    year_of_experience: { type: Number, required: true },
    profile_photo: { type: String, required: true },
    id_proof: { type: String, required: true },
    referral_code: { type: String },
    agent_type: { type: String, enum: ["in_house", "external"] },
    role: { type: String, enum: ["agent", "channel_partner"], default: "agent" },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    last_seen: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Agent", agentSchema);
