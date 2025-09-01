//app/controllers/leads.js
import Lead from "../models/leads.js";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import MasterStatus from "../models/masterStatus.js";
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
      {
        $lookup: {
          from: "agents",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_agent",
        }
      },
      {
        $lookup: {
          from: "channelpartners",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_channel_partner",
        }
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
        }
      },
      {
        $project: {
          assigned_agent: 0,
          assigned_channel_partner: 0,
          __v: 0,
        }
      },
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
      {
        $lookup: {
          from: "agents",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_agent",
        }
      },
      {
        $lookup: {
          from: "channelpartners",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assigned_channel_partner",
        }
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
        }
      },
      {
        $project: {
          assigned_agent: 0,
          assigned_channel_partner: 0,
          __v: 0,
        }
      },
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

/*
const updateLeadStatusById = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { user_role, id: userId, username: userName } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid lead ID");
    }

    if (!status) {
      return handleResponse(res, 400, "Status is required");
    }

    const allowedRoles = ["admin", "agent", "channel_partner"];
    if (!allowedRoles.includes(user_role)) {
      return handleResponse(res, 403, "Access Denied: Unauthorized role");
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return handleResponse(res, 404, "Lead not found");
    }

    // Update status
    lead.status = status.toLowerCase();

    // Add to status_updated_by array
    lead.status_updated_by.push({
      id: userId,
      name: userName,
      role: user_role,
      updated_at: new Date(),
    });


    await lead.save();

    // Prepare custom formatted response
    const leadObj = lead.toObject();

    const formattedStatusUpdates = leadObj.status_updated_by.map(entry => ({
      id: entry.updated_by_id,
      name: entry.updated_by_name,
      role: entry.updated_by_role,
      updated_at: entry.updated_at,
    }));

    leadObj.status_updated_by = formattedStatusUpdates;

    return handleResponse(res, 200, "Lead status updated successfully", leadObj);
  } catch (err) {
    console.error("Error updating lead status:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};
*/

const updateLeadStatus = async ({ req, res, allowedRole }) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // this should be a masterStatus _id string
    const { user_role, id: userId, username: userName } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid lead ID");
    }

    if (!status || !mongoose.Types.ObjectId.isValid(status)) {
      return handleResponse(res, 400, "Invalid or missing status ID");
    }

    // Find master status by id and ensure not deleted
    const masterStatus = await MasterStatus.findOne({ _id: status, deleted: false });
    if (!masterStatus) {
      return handleResponse(res, 404, "Master status not found");
    }

    if (user_role !== allowedRole) {
      return handleResponse(res, 403, `Access Denied: Only ${allowedRole}s allowed`);
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return handleResponse(res, 404, "Lead not found");
    }

    // PERMISSION CHECKS for agent and channel_partner as before
    if (user_role === "agent") {
      const isOwner = lead.created_by_id?.toString() === userId;
      const isAssigned = lead.assigned_to?.toString() === userId;

      if (!isOwner && !isAssigned) {
        return handleResponse(res, 403, "Access Denied: This lead is not yours");
      }
    }

    if (user_role === "channel_partner") {
      const isCreator = lead.created_by_id?.toString() === userId;
      const isAssignedToCP = lead.assigned_to?.toString() === userId;
      const isAssignedByCP = lead.created_by === "channel_partner" && lead.created_by_id?.toString() === userId;

      if (!isCreator && !isAssignedToCP && !isAssignedByCP) {
        return handleResponse(res, 403, "Access Denied: This lead does not belong to you");
      }
    }

    // Update lead status with the name of the master status or ID (choose one)
    // For example, saving the name:
    lead.status = masterStatus.name.toLowerCase();

    // Optionally, if you want to keep reference to master status ID as well:
    lead.master_status_id = masterStatus._id;

    lead.status_updated_by.push({
      id: userId,
      name: userName,
      role: user_role,
      updated_at: new Date(),
    });

    await lead.save();

    const leadObj = lead.toObject();

    leadObj.status_updated_by = leadObj.status_updated_by.map(entry => ({
      id: entry.id,
      name: entry.name,
      role: entry.role,
      updated_at: entry.updated_at,
    }));

    return handleResponse(res, 200, "Lead status updated successfully", leadObj);
  } catch (err) {
    console.error("Error updating lead status:", err);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const updateLeadStatusByAdmin = (req, res) => {
  return updateLeadStatus({ req, res, allowedRole: "admin" });
};

const updateLeadStatusByAgent = (req, res) => {
  return updateLeadStatus({ req, res, allowedRole: "agent" });
};

const updateLeadStatusByChannelPartner = (req, res) => {
  return updateLeadStatus({ req, res, allowedRole: "channel_partner" });
};

export const leads = {
  createLead,
  getLeadById,
  getAllLeadsForAdmin,
  getAllLeadsForChannelPartner,
  getAllLeadsForAgent,
  updateLeadStatus,
  updateLeadStatusByAdmin,
  updateLeadStatusByAgent,
  updateLeadStatusByChannelPartner
};
