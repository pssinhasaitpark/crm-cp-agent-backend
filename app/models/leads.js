// /app/models/leads.js
import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone_number: { type: String, required: true },
  interested_in: { type: String, required: true },
  source: { type: String, required: true },
  date: { type: String, required: true },
  status: { type: String, default: "new" },
  // created_by: { type: String, required: true },
    created_by_role: { type: String },
    created_by_name: { type: String },
    created_by_id: { type: mongoose.Types.ObjectId },
}, { timestamps: true });

export default mongoose.model("Lead", LeadSchema);