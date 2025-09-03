//app/controllers/leads.js
import Lead from "../models/leads.js";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import MasterStatus from "../models/masterStatus.js";
import Project from "../models/projects.js";
import { getLeadValidationSchema, updateLeadSchema } from "../validators/leads.js";
import { handleResponse } from "../utils/helper.js";
import mongoose from "mongoose";

const createLead = async (req, res) => {
  try {
    const { user_role, id: userId, username: userName } = req.user;

    const schema = getLeadValidationSchema(user_role);
    const { error } = schema.validate(req.body);
    if (error) {
      const rawMessage = error.details[0].message;
      const cleanedMessage = rawMessage.replace(/\"/g, "");
      return handleResponse(res, 400, cleanedMessage);
    }

    // Check if lead with email already exists
    const existingLead = await Lead.findOne({ email: req.body.email });
    if (existingLead) {
      return handleResponse(res, 409, "A lead with this email already exists.");
    }

    // ✅ Step: Validate & format interested_in field
    let finalInterestedIn = req.body.interested_in;

    if (mongoose.Types.ObjectId.isValid(finalInterestedIn)) {
      const projectExists = await Project.findById(finalInterestedIn);
      if (!projectExists) {
        return handleResponse(res, 400, "Invalid project ID provided in interested_in field.");
      }

      finalInterestedIn = new mongoose.Types.ObjectId(finalInterestedIn); // clean ObjectId
    } else {
      if (typeof finalInterestedIn !== "string" || finalInterestedIn.trim().length < 3) {
        return handleResponse(res, 400, "Please provide a valid project name in interested_in.");
      }

      finalInterestedIn = finalInterestedIn.trim(); // use as custom text
    }

    // Handle assignment logic
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

    // ✅ Prepare lead data
    const leadData = {
      ...req.body,
      interested_in: finalInterestedIn,
      status: "new",
      assigned_to: assignedToId,
      assigned_to_name: assignedToName,
      assigned_to_model: assignedToModel,
      created_by: user_role,
      created_by_id: userId,
      created_by_name: userName,
    };

    // Remove invalid assignment if agent tries to assign
    if (user_role === "agent" && req.body.assigned_to) {
      delete leadData.assigned_to;
    }

    // Save lead
    const newLead = new Lead(leadData);
    await newLead.save();

    // return handleResponse(res, 201, "Lead created successfully", newLead.toObject());
    // Build custom response with readable interested_in
    const leadObj = newLead.toObject();

    if (mongoose.Types.ObjectId.isValid(leadObj.interested_in)) {
      const project = await Project.findById(leadObj.interested_in).select("project_title");
      if (project) {
        leadObj.interested_in_Id = leadObj.interested_in.toString();
        leadObj.interested_in = project.project_title;
      }
    }

    return handleResponse(res, 201, "Lead created successfully", leadObj);

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
    const { user_role } = req.user;
    const { q = "", status } = req.query;

    if (user_role !== "admin") {
      return handleResponse(res, 403, "Access Denied: Admin only.");
    }

    // Build match filter
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

    // Aggregation pipeline
    const pipeline = [
      { $match: matchStage },

      // ✅ Lookup to projects collection
      {
        $lookup: {
          from: "projects",
          localField: "interested_in",
          foreignField: "_id",
          as: "interested_project"
        }
      },
      {
        $addFields: {
          interested_in_Id: {
            $cond: [
              { $gt: [{ $size: "$interested_project" }, 0] },
              { $arrayElemAt: ["$interested_project._id", 0] },
              null
            ]
          },
          interested_in: {
            $cond: [
              { $gt: [{ $size: "$interested_project" }, 0] },
              { $arrayElemAt: ["$interested_project.project_title", 0] },
              "$interested_in" // fallback to original value (custom string)
            ]
          }
        }
      },
      { $project: { interested_project: 0 } }, // remove raw project data
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

    // Build the match stage
    let matchStage = {
      $and: [
        {
          $or: [
            { created_by_id: new mongoose.Types.ObjectId(String(userId)) },
            { assigned_to: new mongoose.Types.ObjectId(String(userId)) }
          ]
        }
      ]
    };

    if (status) {
      matchStage.$and.push({ status: status.toLowerCase() });
    }

    if (q) {
      const regex = new RegExp(q, "i");
      matchStage.$and.push({
        $or: [
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
          { status: regex },
        ],
      });
    }

    const pipeline = [
      { $match: matchStage },
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
          source_type: {
            $cond: [
              { $eq: ["$created_by_id", new mongoose.Types.ObjectId(String(userId))] },
              "self_lead",
              {
                $cond: [
                  { $eq: ["$created_by", "admin"] },
                  "admin_assigned_lead",
                  "other"
                ]
              }
            ]
          }
        },
      },
      {
        $project: {
          assigned_agent: 0,
          assigned_channel_partner: 0,
          __v: 0,
          // Optionally show or remove fields: created_by_id, created_by
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    // Fetch leads
    const leads = await Lead.aggregate(pipeline);

    // Fetch master statuses
    const masterStatuses = await MasterStatus.find({ deleted: false }).lean();

    // Calculate status breakdown
    const statusCounts = leads.reduce((acc, lead) => {
      const st = lead.status?.toLowerCase();
      if (st) acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});

    const statusBreakdown = {};
    masterStatuses.forEach((stat) => {
      const key = stat.name.toLowerCase();
      statusBreakdown[key] = statusCounts[key] || 0;
    });

    statusBreakdown.totalItems = leads.length;

    // Count by source_type ("self_lead" or "admin_assigned_lead")
    const typeCounts = leads.reduce(
      (acc, lead) => {
        if (lead.source_type === "self_lead") acc.self_lead_count++;
        else if (lead.source_type === "admin_assigned_lead") acc.admin_assigned_lead_count++;
        return acc;
      },
      { self_lead_count: 0, admin_assigned_lead_count: 0 }
    );

    // Done — prepare final response data
    return handleResponse(res, 200, "Leads fetched successfully", {
      results: leads,
      self_lead_count: typeCounts.self_lead_count,
      admin_assigned_lead_count: typeCounts.admin_assigned_lead_count,
      ...statusBreakdown,
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

    // Fetch leads
    const leads = await Lead.aggregate(pipeline);

    // Fetch master statuses
    const masterStatuses = await MasterStatus.find({ deleted: false }).lean();

    // Count current statuses from leads
    const statusCounts = leads.reduce((acc, lead) => {
      const status = lead.status?.toLowerCase();
      if (status) {
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {});

    // Build final status breakdown
    const statusBreakdown = {};
    masterStatuses.forEach((statusDoc) => {
      const key = statusDoc.name.toLowerCase();
      statusBreakdown[key] = statusCounts[key] || 0;
    });

    // Add total count
    statusBreakdown.totalItems = leads.length;

    return handleResponse(res, 200, "Leads fetched successfully", {
      results: leads,
      ...statusBreakdown,
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
            { $match: { $expr: { $eq: ["$_id", "$$statusId"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "status_info"
        }
      },
      {
        // Lookup project info to get project_title
        $lookup: {
          from: "projects",
          let: { interestedInId: "$interested_in" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $convert: { input: "$$interestedInId", to: "objectId", onError: null, onNull: null } }]
                }
              }
            },
            { $project: { project_title: 1 } }
          ],
          as: "interested_in_info"
        }
      },
      {
        $addFields: {
          status_readable: { $arrayElemAt: ["$status_info.name", 0] },

          // keep interested_in_Id as is
          interested_in_Id: {
            $cond: [
              { $eq: [{ $type: "$interested_in" }, "objectId"] },
              "$interested_in",
              null
            ]
          },

          // Replace interested_in with project_title if found; else keep original interested_in value
          interested_in: {
            $cond: [
              { $gt: [{ $size: "$interested_in_info" }, 0] },
              { $arrayElemAt: ["$interested_in_info.project_title", 0] },
              "$interested_in"
            ]
          },

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
          interested_in_info: 0,
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
  getLeadDetailsByAgentId,
};
