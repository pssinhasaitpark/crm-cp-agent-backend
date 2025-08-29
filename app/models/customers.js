// app/models/customer.js
import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone_number: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    property_type: { type: String },
    requirement_type: { type: String },
    source: { type: String },
    notes: { type: String },
    assigned_to: { type: mongoose.Types.ObjectId, refPath: "assigned_to_model" },
    assigned_to_name: { type: String },
    assigned_to_model: { type: String, enum: ["Agent", "ChannelPartner"] },
    status: { type: String, default: "new" },
    created_by: { type: String },
    created_by_id: { type: mongoose.Schema.Types.ObjectId },
    created_by_name: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", CustomerSchema);
