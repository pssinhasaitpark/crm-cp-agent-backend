//app/controllers/leads.js
import Lead from "../models/leads.js";
import { leadValidationSchema } from "../validators/leads.js";
import { handleResponse } from "../utils/helper.js";

const createLead = async (req, res) => {
  try {
    // Step 1: Validate request body with your schema
    const { error } = leadValidationSchema.validate(req.body);
    if (error) {
      return handleResponse(res, 400, error.details[0].message);
    }

    const { user_role, agent_type } = req.user;
    let createdBy = null;

    // Step 2: Determine who is creating the lead based on user_role and agent_type
    if (user_role === "admin") {
      createdBy = "admin";
    } else if (user_role === "channel_partner") {
      createdBy = "channel partner";
    } else if (user_role === "agent") {
      createdBy = "agent";
    } else {
      return handleResponse(
        res,
        403,
        "Access Denied: Only admin, channel partner, or agent can create leads."
      );
    }

    // Step 3: Check for existing lead with the same email
    const existingLead = await Lead.findOne({ email: req.body.email });
    if (existingLead) {
      return handleResponse(res, 409, "A lead with this email already exists.");
    }

    // Step 4: Create new lead and save to DB
    const lead = new Lead({
      ...req.body,
      status: "new",
      created_by: createdBy,
    });

    await lead.save();

    // Step 5: Return success response with lead data
    return handleResponse(res, 201, "Lead created successfully", lead.toObject());
  } catch (err) {
    console.error("Error creating lead:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

export const leads = {
    createLead
}