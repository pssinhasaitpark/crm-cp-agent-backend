//app/controllers/leads.js
import Lead from "../models/leads.js";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import { getLeadValidationSchema } from "../validators/leads.js";
import { handleResponse } from "../utils/helper.js";
import mongoose from "mongoose";

const createLead = async (req, res) => {
  try {
    const { user_role, id: userId, username: userName } = req.user;

    const schema = getLeadValidationSchema(user_role);
    const { error } = schema.validate(req.body);
    if (error) return handleResponse(res, 400, error.details[0].message);

    const existingLead = await Lead.findOne({ email: req.body.email });
    if (existingLead) return handleResponse(res, 409, "A lead with this email already exists.");

    let assignedToId = null;
    let assignedToName = null;
    let assignedToModel = null;

    if (user_role === "agent") {
      assignedToId = userId;
      assignedToName = userName;
      assignedToModel = "Agent";
    } else if (user_role === "channel_partner") {
      assignedToId = req.body.assigned_to;

      const cp = await ChannelPartner.findById(assignedToId);
      const ag = await Agent.findById(assignedToId);

      if (cp) {
        assignedToName = cp.name;
        assignedToModel = "ChannelPartner";
      } else if (ag) {
        assignedToName = ag.name;
        assignedToModel = "Agent";
      } else {
        return handleResponse(res, 400, "Invalid assigned_to: No matching agent or channel partner found.");
      }
    } else if (user_role === "admin") {
      assignedToId = req.body.assigned_to || null;

      if (assignedToId) {
        const cp = await ChannelPartner.findById(assignedToId);
        const ag = await Agent.findById(assignedToId);

        if (cp) {
          assignedToName = cp.name;
          assignedToModel = "ChannelPartner";
        } else if (ag) {
          assignedToName = ag.name;
          assignedToModel = "Agent";
        } else {
          return handleResponse(res, 400, "Invalid assigned_to: No matching agent or channel partner found.");
        }
      }
    } else {
      return handleResponse(res, 403, "Access Denied: Only admin, channel partner, or agent can create leads.");
    }

    const leadData = {
      ...req.body,
      status: "new",
      assigned_to: assignedToId,
      assigned_to_name: assignedToName,
      assigned_to_model: assignedToModel,
      created_by: user_role,
      created_by_id: userId,
      created_by_name: userName,
    };

    if (user_role === "agent" && req.body.assigned_to) {
      delete leadData.assigned_to;
    }

    const newLead = new Lead(leadData);
    await newLead.save();

    const responsePayload = {
      success: true,
      error: false,
      message: "Lead created successfully",
      ...newLead.toObject(),
    };

    // return res.status(201).json(responsePayload);
    return handleResponse(res, 201, "Lead created successfully", newLead.toObject());
  } catch (err) {
    console.error("Error creating lead:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllLeadsForAdmin = async (req, res) => {
  try {
    const { user_role, id: userId } = req.user;
    const { q = "", status } = req.query;

    if (user_role !== "admin") {
      return handleResponse(res, 403, "Access Denied: Admin only.");
    }

    let matchStage = {};

    if (status) {
      matchStage.status = status.toLowerCase();
    }

    if (q) {
      const regex = new RegExp(q, "i");
      matchStage.$or = [
        { name: regex },
        { email: regex },
        { phone_number: regex },
        { interested_in: regex },
        { source: regex },
        { address: regex },
        { property_type: regex },
        { requirement_type: regex },
        { budget: regex },
        { remark: regex },
        { assigned_to_name: regex },
        { created_by_name: regex },
      ];
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
    ];

    const leads = await Lead.aggregate(pipeline);

    return handleResponse(res, 200, "Leads fetched successfully", {
      results: leads,
      totalItems: leads.length,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllLeadsForChannelPartner = async (req, res) => {
  try {
    const { user_role, id: userId } = req.user;
    const { q = "", status } = req.query;

    if (user_role !== "channel_partner") {
      return handleResponse(res, 403, "Access Denied: Channel Partner only.");
    }

    let matchStage = { 
      $or: [
        { created_by_id: new mongoose.Types.ObjectId(String(userId)) },  
        { assigned_to: new mongoose.Types.ObjectId(String(userId)) }     
      ]
    };

    if (status) {
      matchStage.status = status.toLowerCase();
    }

    if (q) {
      const regex = new RegExp(q, "i");
      matchStage.$or.push(
        { name: regex },
        { email: regex },
        { phone_number: regex },
        { interested_in: regex },
        { source: regex },
        { address: regex },
        { property_type: regex },
        { requirement_type: regex },
        { budget: regex },
        { remark: regex },
        { assigned_to_name: regex },
        { created_by_name: regex },
      );
    }

    const pipeline = [
      { $match: matchStage },
      { $lookup: {
        from: "agents",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assigned_agent",
      }},
      { $lookup: {
        from: "channelpartners",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assigned_channel_partner",
      }},
      { $addFields: {
        assigned_to_full_details: {
          $cond: [
            { $eq: ["$assigned_to_model", "Agent"] },
            { $arrayElemAt: ["$assigned_agent", 0] },
            { $arrayElemAt: ["$assigned_channel_partner", 0] },
          ],
        },
      }},
      { $project: {
        assigned_agent: 0,
        assigned_channel_partner: 0,
        __v: 0,
      }},
      { $sort: { createdAt: -1 } },
    ];

    const leads = await Lead.aggregate(pipeline);

    return handleResponse(res, 200, "Leads fetched successfully", {
      results: leads,
      totalItems: leads.length,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllLeadsForAgent = async (req, res) => {
  try {
    const { user_role, id: userId } = req.user;
    const { q = "", status } = req.query;

    if (user_role !== "agent") {
      return handleResponse(res, 403, "Access Denied: Agent only.");
    }

    let matchStage = { 
      $or: [
        { created_by_id: new mongoose.Types.ObjectId(String(userId)) }, 
        { assigned_to: new mongoose.Types.ObjectId(String(userId)) }     
      ]
    };

    if (status) {
      matchStage.status = status.toLowerCase();
    }

    if (q) {
      const regex = new RegExp(q, "i");
      matchStage.$or.push(
        { name: regex },
        { email: regex },
        { phone_number: regex },
        { interested_in: regex },
        { source: regex },
        { address: regex },
        { property_type: regex },
        { requirement_type: regex },
        { budget: regex },
        { remark: regex },
        { assigned_to_name: regex },
        { created_by_name: regex },
      );
    }

    const pipeline = [
      { $match: matchStage },
      { $lookup: {
        from: "agents",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assigned_agent",
      }},
      { $lookup: {
        from: "channelpartners",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assigned_channel_partner",
      }},
      { $addFields: {
        assigned_to_full_details: {
          $cond: [
            { $eq: ["$assigned_to_model", "Agent"] },
            { $arrayElemAt: ["$assigned_agent", 0] },
            { $arrayElemAt: ["$assigned_channel_partner", 0] },
          ],
        },
      }},
      { $project: {
        assigned_agent: 0,
        assigned_channel_partner: 0,
        __v: 0,
      }},
      { $sort: { createdAt: -1 } },
    ];

    const leads = await Lead.aggregate(pipeline);

    return handleResponse(res, 200, "Leads fetched successfully", {
      results: leads,
      totalItems: leads.length,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid lead ID");
    }

    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(String(id)) } },

      {
        $lookup: {
          from: "agents",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_agent",
        },
      },

      {
        $lookup: {
          from: "channelpartners",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_channel_partner",
        },
      },

      {
        $addFields: {
          assigned_to_full_details: {
            $cond: [
              { $eq: ["$assigned_to_model", "Agent"] },
              { $arrayElemAt: ["$assigned_agent", 0] },
              { $arrayElemAt: ["$assigned_channel_partner", 0] },
            ],
          },
        },
      },

      {
        $project: {
          assigned_agent: 0,
          assigned_channel_partner: 0,
          __v: 0,
        },
      },
    ];

    const leadArr = await Lead.aggregate(pipeline);
    if (leadArr.length === 0) {
      return handleResponse(res, 404, "Lead not found");
    }

    const lead = leadArr[0];

    return handleResponse(res, 200, "Lead fetched successfully", lead);
  } catch (error) {
    console.error("Error fetching lead by ID:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

export const leads = {
  createLead,
  getLeadById,
  getAllLeadsForAdmin,
  getAllLeadsForChannelPartner,
  getAllLeadsForAgent
};
