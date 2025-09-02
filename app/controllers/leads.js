//app/controllers/leads.js
import Lead from "../models/leads.js";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import MasterStatus from "../models/masterStatus.js";
import { getLeadValidationSchema, updateLeadSchema } from "../validators/leads.js";
import { handleResponse } from "../utils/helper.js";
import mongoose from "mongoose";
/*
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
*/

const createLead = async (req, res) => {
  try {
    const { user_role, id: userId, username: userName } = req.user;

    const schema = getLeadValidationSchema(user_role);
    const { error } = schema.validate(req.body);
    // if (error) return handleResponse(res, 400, error.details[0].message);
    if (error) {
      const rawMessage = error.details[0].message;
      const cleanedMessage = rawMessage.replace(/\"/g, "");
      return handleResponse(res, 400, cleanedMessage);
    }

    const existingLead = await Lead.findOne({ email: req.body.email });
    if (existingLead) {
      return handleResponse(res, 409, "A lead with this email already exists.");
    }

    let assignedToId = null;
    let assignedToName = null;
    let assignedToModel = null;

    if (user_role === "agent") {
      assignedToId = userId;
      assignedToName = userName;
      assignedToModel = "Agent";

    } else if (user_role === "channel_partner") {
      assignedToId = req.body.assigned_to;

      if (!mongoose.Types.ObjectId.isValid(assignedToId)) {
        return handleResponse(res, 400, "Invalid assigned_to: Not a valid MongoDB ObjectId.");
      }

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
        if (!mongoose.Types.ObjectId.isValid(assignedToId)) {
          return handleResponse(res, 400, "Invalid assigned_to: Not a valid MongoDB ObjectId.");
        }

        const cp = await ChannelPartner.findById(assignedToId);
        const ag = await Agent.findById(assignedToId);

        if (cp) {
          assignedToName = cp.name;
          assignedToModel = "ChannelPartner";
        } else if (ag) {
          assignedToName = ag.name;
          assignedToModel = "Agent";
        } else {
          return handleResponse(res, 400, "Invalid assigned_to Id: No matching agent or channel partner found.");
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

    return handleResponse(res, 201, "Lead created successfully", newLead.toObject());
  } catch (err) {
    console.error("Error creating lead:", err);

    if (err.name === "CastError" && err.kind === "ObjectId") {
      return handleResponse(res, 400, "Invalid ObjectId provided.");
    }

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

const updateLeadStatus = async ({ req, res, allowedRole }) => {
  try {
    const { id } = req.params;
    const { status, assigned_to } = req.body;
    const { user_role, id: userId, username: userName } = req.user;

    const { error } = updateLeadSchema.validate(req.body);
    if (error) {
      const cleanMessage = error.message.replace(/\"/g, "");
      return handleResponse(res, 400, `Invalid request body: ${cleanMessage}`);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid lead ID");
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return handleResponse(res, 404, "Lead not found");
    }

    if (user_role !== allowedRole) {
      return handleResponse(res, 403, `Access Denied: Only ${allowedRole}s allowed`);
    }

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

    if (status) {
      if (!mongoose.Types.ObjectId.isValid(status)) {
        return handleResponse(res, 400, "Invalid status ID");
      }

      const masterStatus = await MasterStatus.findOne({ _id: status, deleted: false });
      if (!masterStatus) {
        return handleResponse(res, 404, "Master status not found");
      }

      lead.status = masterStatus.name.toLowerCase();
      lead.master_status_id = masterStatus._id;

      lead.status_updated_by.push({
        id: userId,
        name: userName,
        role: user_role,
        updated_at: new Date(),
        status: masterStatus.name.toLowerCase(), // Save status at update time
      });
    }

    if (assigned_to) {
      if (!mongoose.Types.ObjectId.isValid(assigned_to)) {
        return handleResponse(res, 400, "Invalid assigned_to ID");
      }

      let assignedUser = await Agent.findOne({ _id: assigned_to, deleted: false });

      if (assignedUser) {
        lead.assigned_to = assigned_to;
        lead.assigned_to_model = "Agent";
        lead.assigned_to_name = assignedUser.name;
      } else {
        assignedUser = await ChannelPartner.findOne({ _id: assigned_to, deleted: false });

        if (assignedUser) {
          lead.assigned_to = assigned_to;
          lead.assigned_to_model = "ChannelPartner";
          lead.assigned_to_name = assignedUser.name;
        } else {
          return handleResponse(res, 404, "Assigned user not found in Agent or ChannelPartner");
        }
      }
    }

    await lead.save();

    const leadObj = lead.toObject();

    leadObj.status_updated_by = leadObj.status_updated_by.map(entry => ({
      id: entry.id,
      name: entry.name,
      role: entry.role,
      updated_at: entry.updated_at,
      status: entry.status, // Include stored status per update
    }));

    return handleResponse(res, 200, "Lead updated successfully", leadObj);
  } catch (err) {
    console.error("Error updating lead:", err);
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

const getLeadDetailsByAgentId = async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return handleResponse(res, 400, "Invalid agent ID");
    }

    const pipeline = [
      {
        $match: {
          assigned_to: new mongoose.Types.ObjectId(agentId),
          assigned_to_model: "Agent",
        }
      },
      {
        $lookup: {
          from: "masterstatuses",
          let: { statusId: "$master_status_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$statusId"] }
              }
            },
            {
              $project: { _id: 0, name: 1 }
            }
          ],
          as: "status_info"
        }
      },
      {
        $addFields: {
          status_readable: { $arrayElemAt: ["$status_info.name", 0] },
          status_updated_by: {
            $map: {
              input: "$status_updated_by",
              as: "entry",
              in: {
                id: "$$entry.id",
                name: "$$entry.name",
                role: "$$entry.role",
                updated_at: "$$entry.updated_at",
                status: "$$entry.status"
              }
            }
          }
        }
      },
      {
        $project: {
          status_info: 0,
          __v: 0
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ];

    const leads = await Lead.aggregate(pipeline);

    return handleResponse(res, 200, "Leads for agent fetched successfully", {
      results: leads,
      totalItems: leads.length,
    });

  } catch (error) {
    console.error("Error fetching leads by agent ID:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
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
  updateLeadStatusByChannelPartner,
  getLeadDetailsByAgentId
};
