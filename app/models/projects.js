// //app/models/projects.js
import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    project_title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    price_range: { type: String, required: true }, // stored as string
    images: { type: [String], required: true }, // multiple URLs
    brouchers: { type: String, required: true }, // single PDF URL
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    created_by_role: { type: String, enum: ["admin", "agent", "channel_partner"] },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);
