//app/models/leads.js
import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone_number: { type: String, required: true },
  // interested_in: { type: String, required: true },
  interested_in: { type: mongoose.Schema.Types.Mixed, required: true },
  source: { type: String, required: true },
  status: { type: String, default: "new" },

  address: { type: String },
  property_type: { type: String },
  requirement_type: { type: String },
  budget: { type: String },
  remark: { type: String },
  location: { type: String },

  assigned_to: { type: mongoose.Types.ObjectId, refPath: "assigned_to_model" },
  assigned_to_name: { type: String },
  assigned_to_model: { type: String, enum: ["Agent", "ChannelPartner"] },

  created_by: { type: String },
  created_by_id: { type: mongoose.Schema.Types.ObjectId },
  created_by_name: { type: String },

  status_updated_by: [
    {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
      status: { type: String },
      updated_at: { type: Date, default: Date.now }
    }
  ],

  is_broadcasted: { type: Boolean, default: false },
  broadcasted_at: { type: Date, default: null },
  broadcasted_to: [{ type: mongoose.Schema.Types.ObjectId, ref: "Agent" }],
  lead_accepted_by: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", default: null },
  lead_accepted_by_name: { type: String },
  lead_accepted_at: { type: Date, default: null },

  declined_by: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent"
  }],

 follow_ups: [
  {
    task: { type: String },
    notes: { type: String },
    follow_up_date: { type: Date },
    added_by: {
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
      role: { type: String }
    },
    created_at: { type: Date, default: Date.now }
  }
],


}, { timestamps: true });

export default mongoose.model("Lead", LeadSchema);