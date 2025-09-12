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

    const existingLead = await Lead.findOne({ email: req.body.email });
    if (existingLead) {
      return handleResponse(res, 409, "A lead with this email already exists.");
    }

    let finalInterestedIn = req.body.interested_in;

    if (mongoose.Types.ObjectId.isValid(finalInterestedIn)) {
      const projectExists = await Project.findById(finalInterestedIn);
      if (!projectExists) {
        return handleResponse(res, 400, "Invalid project ID provided in interested_in field.");
      }

      finalInterestedIn = new mongoose.Types.ObjectId(String(finalInterestedIn));
    } else {
      if (typeof finalInterestedIn !== "string" || finalInterestedIn.trim().length < 3) {
        return handleResponse(res, 400, "Please provide a valid project name in interested_in.");
      }

      finalInterestedIn = finalInterestedIn.trim();
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
      interested_in: finalInterestedIn,
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

    // return handleResponse(res, 201, "Lead created successfully", newLead.toObject());
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
              "$interested_in"
            ]
          }
        }
      },
      { $project: { interested_project: 0 } },
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
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const leads = await Lead.aggregate(pipeline);

    const masterStatuses = await MasterStatus.find({ deleted: false }).lean();

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

    const typeCounts = leads.reduce(
      (acc, lead) => {
        if (lead.source_type === "self_lead") acc.self_lead_count++;
        else if (lead.source_type === "admin_assigned_lead") acc.admin_assigned_lead_count++;
        return acc;
      },
      { self_lead_count: 0, admin_assigned_lead_count: 0 }
    );

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
      $and: [
        {
          $or: [
            { created_by_id: new mongoose.Types.ObjectId(String(userId)) },
            { assigned_to: new mongoose.Types.ObjectId(String(userId)) },
            { declined_by: new mongoose.Types.ObjectId(String(userId)) }
          ]
        },
        {
          $or: [
            { is_broadcasted: { $ne: true } },
            { lead_accepted_by: new mongoose.Types.ObjectId(String(userId)) }
          ]
        }
      ]
    };

    if (status) {
      matchStage.status = status.toLowerCase();
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
        ]
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
      { $sort: { lead_accepted_at: -1, createdAt: -1 } },
    ];

    const leads = await Lead.aggregate(pipeline);

    const masterStatuses = await MasterStatus.find({ deleted: false }).lean();

    const statusCounts = leads.reduce((acc, lead) => {
      const status = lead.status?.toLowerCase();
      if (status) {
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {});

    const statusBreakdown = {};
    masterStatuses.forEach((statusDoc) => {
      const key = statusDoc.name.toLowerCase();
      statusBreakdown[key] = statusCounts[key] || 0;
    });

    statusBreakdown.totalItems = leads.length;

    const broadcastAcceptedCount = await Lead.countDocuments({
      is_broadcasted: false,
      lead_accepted_by: new mongoose.Types.ObjectId(String(userId)),
    });

    return handleResponse(res, 200, "Leads fetched successfully", {
      results: leads,
      ...statusBreakdown,
      broadcast_list_count: broadcastAcceptedCount,
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
  const io = req.io;
  try {
    const { id } = req.params;
    const { status, assigned_to, action } = req.body;
    const { user_role, id: userId, username: userName } = req.user;

    console.log("📥 Incoming request to update lead:", {
      leadId: id,
      status,
      assigned_to,
      action,
      user_role,
      userId,
      userName,
    });

    const { error } = updateLeadSchema.validate(req.body);
    if (error) {
      const cleanMessage = error.message.replace(/\"/g, "");
      return handleResponse(res, 400, `Invalid request body: ${cleanMessage}`);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid lead ID");
    }

    const lead = await Lead.findById(id);
    if (!lead) return handleResponse(res, 404, "Lead not found");

    console.log("📄 Fetched lead from DB:", lead);

    // === Role Restriction ===
    if (user_role !== allowedRole) {
      return handleResponse(res, 403, `Access Denied: Only ${allowedRole}s allowed`);
    }

    // === Agent Permissions ===
    if (user_role === "agent") {
      const isOwner = lead.created_by_id?.toString() === userId.toString();
      const isAssigned = lead.assigned_to?.toString() === userId.toString();
      const isBroadcasted = lead.is_broadcasted && Array.isArray(lead.broadcasted_to) && lead.broadcasted_to.map(id => id.toString()).includes(userId.toString());

      if (!isOwner && !isAssigned && !isBroadcasted) {
        return handleResponse(res, 403, "Access Denied: This lead is not yours");
      }
    }

    // === Channel Partner Permissions ===
    if (user_role === "channel_partner") {
      const isCreator = lead.created_by_id?.toString() === userId.toString();
      const isAssignedToCP = lead.assigned_to?.toString() === userId.toString();
      const isAssignedByCP = lead.created_by === "channel_partner" && lead.created_by_id?.toString() === userId.toString();

      if (!isCreator && !isAssignedToCP && !isAssignedByCP) {
        return handleResponse(res, 403, "Access Denied: This lead does not belong to you");
      }
    }

    if (lead.is_broadcasted && Array.isArray(lead.broadcasted_to) && lead.broadcasted_to.map(id => id.toString()).includes(userId.toString())) {
      console.log("📡 Broadcast accept/decline path triggered");

      if (!action) return handleResponse(res, 400, "Action is required for broadcasted lead (accept/decline)");

      if (action === "accept") {
        if (lead.lead_accepted_by) {
          return handleResponse(res, 409, `Lead already accepted by ${lead.lead_accepted_by_name}`);
        }

        console.log("✅Lead is being accepted");

        const broadcastedAgents = lead.broadcasted_to.filter(agentId => agentId && typeof agentId.toString === "function");

        lead.lead_accepted_by = userId;
        lead.lead_accepted_by_name = userName;
        lead.lead_accepted_by_model = user_role === "agent" ? "Agent" : "ChannelPartner";

        lead.assigned_to = userId;
        lead.assigned_to_model = user_role === "agent" ? "Agent" : "ChannelPartner";
        lead.assigned_to_name = userName;

        lead.is_broadcasted = false;
        lead.broadcasted_to = [];

        await lead.save();

        // Notify other agents
        broadcastedAgents.forEach(agentId => {
          if (!agentId || typeof agentId.toString !== "function") return;

          const agentIdStr = agentId.toString();
          if (agentIdStr !== userId.toString()) {
            console.log(`📣 Notifying agent ${agentIdStr} about lead acceptance`);
            io.to(agentIdStr).emit("lead_accepted", {
              leadId: lead._id,
              message: `Lead accepted by ${userName}`,
            });
          }
        });

        // ✅ Notify admins
        console.log(`🔔 Notifying admins about lead acceptance by ${userName} (${user_role})`);
        io.to("admins").emit("lead_accepted", {
          leadId: lead._id,
          acceptedBy: {
            id: userId,
            name: userName,
            role: user_role,
          },
          message: `Lead accepted by ${userName} (${user_role})`,
        });


        return handleResponse(res, 200, "Lead accepted successfully", lead);
      }

      if (action === "decline") {
        console.log(`🚫 Lead declined by ${userId}`);
        return handleResponse(res, 200, "Lead declined successfully");
      }

      return handleResponse(res, 400, "Invalid action. Use 'accept' or 'decline'");
    }

    // === Update Status ===
    if (status) {
      if (!mongoose.Types.ObjectId.isValid(status)) {
        return handleResponse(res, 400, "Invalid status ID");
      }

      const masterStatus = await MasterStatus.findOne({ _id: status, deleted: false });
      if (!masterStatus) return handleResponse(res, 404, "Master status not found");

      console.log("🔄 Updating lead status to:", masterStatus.name);

      lead.status = masterStatus.name.toLowerCase();
      lead.master_status_id = masterStatus._id;

      lead.status_updated_by.push({
        id: userId,
        name: userName,
        role: user_role,
        updated_at: new Date(),
        status: masterStatus.name.toLowerCase(),
      });
    }

    // === Assign to Agent/CP or Broadcast ===
    if (assigned_to) {
      if (assigned_to === "all") {
        console.log("📢 Broadcasting lead to all active agents");

        const allAgents = await Agent.find({ deleted: false, status: "active" });
        if (!allAgents.length) return handleResponse(res, 404, "No active agents found for broadcast");

        const agentIds = allAgents
          .filter(agent => agent && agent._id)
          .map(agent => agent._id);

        console.log("🧑‍🤝‍🧑 Active agent IDs:", agentIds.map(id => id.toString()));

        lead.is_broadcasted = true;
        lead.broadcasted_to = agentIds;
        lead.assigned_to = null;
        lead.assigned_to_model = null;
        lead.assigned_to_name = null;
        lead.lead_accepted_by = null;
        lead.lead_accepted_by_name = null;
        lead.lead_accepted_by_model = null;

        await lead.save();

        allAgents.forEach(agent => {
          if (!agent || !agent._id || typeof agent._id.toString !== "function") {
            console.warn("⚠️ Invalid agent._id while emitting:", agent);
            return;
          }

          const agentIdStr = agent._id.toString();
          console.log(`📨 Emitting 'new_lead' to agent ${agentIdStr}`);

          io.to(agentIdStr).emit("new_lead", {
            leadId: lead._id,
            message: "New lead available to accept",
          });
        });

        return handleResponse(res, 200, "Lead broadcasted to all agents");
      }

      // Individual assignment
      if (!mongoose.Types.ObjectId.isValid(assigned_to)) {
        return handleResponse(res, 400, "Invalid assigned_to ID");
      }

      let assignedUser = await Agent.findOne({ _id: assigned_to, deleted: false });

      if (assignedUser) {
        console.log("👤 Assigning lead to agent:", assignedUser.name);
        lead.assigned_to = assigned_to;
        lead.assigned_to_model = "Agent";
        lead.assigned_to_name = assignedUser.name;
      } else {
        assignedUser = await ChannelPartner.findOne({ _id: assigned_to, deleted: false });

        if (assignedUser) {
          console.log("🤝 Assigning lead to channel partner:", assignedUser.name);
          lead.assigned_to = assigned_to;
          lead.assigned_to_model = "ChannelPartner";
          lead.assigned_to_name = assignedUser.name;
        } else {
          return handleResponse(res, 404, "Assigned user not found in Agent or ChannelPartner");
        }
      }

      lead.is_broadcasted = false;
      lead.broadcasted_to = [];
      lead.lead_accepted_by = null;
      lead.lead_accepted_by_name = null;
      lead.lead_accepted_by_model = null;
    }

    // === Final Save and Response ===
    await lead.save();

    const leadObj = lead.toObject();
    leadObj.status_updated_by = leadObj.status_updated_by.map(entry => ({
      id: entry.id,
      name: entry.name,
      role: entry.role,
      updated_at: entry.updated_at,
      status: entry.status,
    }));

    console.log("Final updated lead object:", leadObj);

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
          assigned_to: new mongoose.Types.ObjectId(String(agentId)),
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

          interested_in_Id: {
            $cond: [
              { $eq: [{ $type: "$interested_in" }, "objectId"] },
              "$interested_in",
              null
            ]
          },

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

const acceptLead = async (req, res) => {
  try {
    const io = req.io;

    const { leadId } = req.params;
    const agentId = req.user.id;
    const agentName = req.user.username;

    const lead = await Lead.findById(leadId);

    if (!lead) {
      return handleResponse(res, 404, "Lead not found");
    }

    if (lead.lead_accepted_by) {
      return handleResponse(res, 400, `Lead already accepted by ${lead.lead_accepted_by_name}`);
    }

    if (!lead.is_broadcasted) {
      return handleResponse(res, 403, "Lead is not broadcasted");
    }

    if (!lead.broadcasted_to.map(id => id.toString()).includes(agentId)) {
      return handleResponse(res, 403, "You were not eligible for this lead");
    }

    lead.assigned_to = agentId;
    lead.assigned_to_model = "Agent";
    lead.assigned_to_name = agentName;
    lead.lead_accepted_by = agentId;
    lead.lead_accepted_by_name = agentName;
    lead.lead_accepted_at = new Date();
    lead.is_broadcasted = false;

    await lead.save();

    console.log("Broadcasted to:", lead.broadcasted_to);

    if (Array.isArray(lead.broadcasted_to)) {
      lead.broadcasted_to.forEach(otherId => {
        if (!otherId) return;

        const otherIdStr = otherId.toString();
        const agentIdStr = agentId.toString();

        if (otherIdStr !== agentIdStr) {
          console.log(`Emitting to room: ${otherIdStr}`);
          io.to(otherIdStr)?.emit("lead_taken", {
            leadId,
            accepted_by: agentName,
            message: `Lead already accepted by ${agentName}`,
          });
        }
      });
    }


    //Notify admins
    console.log(`🔔 Notifying admins about lead acceptance by ${agentName} (agent)`);
    io.to("admins").emit("lead_accepted", {
      leadId: lead._id,
      acceptedBy: {
        id: agentId,
        name: agentName,
        role: "agent", // This acceptLead is only for agents
      },
      message: `Lead accepted by ${agentName} (agent)`,
    });

    return handleResponse(res, 200, "Lead accepted successfully", lead.toObject());

  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Internal server error");
  }
};

const declineLead = async (req, res) => {
  try {
    const io = req.io;
    const { leadId } = req.params;
    const agentId = req.user.id;
    const agentName = req.user.username;

    const lead = await Lead.findById(leadId);

    if (!lead || !lead.is_broadcasted) {
      return handleResponse(res, 404, "Lead not found or not broadcasted");
    }

    if (!lead.declined_by.includes(agentId)) {
      lead.declined_by.push(agentId);
    }

    lead.broadcasted_to = lead.broadcasted_to.filter(id => id.toString() !== agentId);
    await lead.save();

    //notify admins
    io.to("admins").emit("lead_declined", {
      leadId,
      declinedBy: {
        id: agentId,
        name: agentName,
        role: "agent", // or "channel_partner"
      },
      message: `Lead declined by ${agentName}`,
    });

    return handleResponse(res, 200, "Lead declined");
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Internal server error");
  }
};

const getAllBroadCastedLeads = async (req, res) => {
  try {
    const { q = "", status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let matchStage = {
      $and: [
        {
          $or: [
            { is_broadcasted: true },
            { broadcasted_to: { $exists: true, $not: { $size: 0 } } }
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
        ]
      });
    }

    const pipeline = [
      { $match: matchStage },

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
              "$interested_in"
            ]
          },
          isAccepted: {
            $cond: [
              { $ne: ["$lead_accepted_by", null] },
              true,
              false
            ]
          }
        }
      },
      {
        $project: {
          interested_project: 0,
          __v: 0
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const countPipeline = [
      { $match: matchStage },
      { $count: "totalItems" }
    ];

    const [leads, countResult] = await Promise.all([
      Lead.aggregate(pipeline),
      Lead.aggregate(countPipeline)
    ]);

    const totalItems = countResult[0]?.totalItems || 0;

    return handleResponse(res, 200, "Broadcasted leads fetched successfully", {
      results: leads,
      totalItems,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
    });

  } catch (error) {
    console.error("Error fetching broadcasted leads:", error);
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
  acceptLead,
  declineLead,
  getAllBroadCastedLeads,
};
