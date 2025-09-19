// app/controllers/agent.js
import bcrypt from "bcryptjs";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import { followUpSchema } from "../validators/agent.js";
import { handleResponse } from "../utils/helper.js";
import { createAgentValidator } from "../validators/agent.js";
import { uploadFilesToCloudinary } from "../middlewares/multer.js";
import { signAccessToken } from "../middlewares/jwtAuth.js";
import mongoose from "mongoose";
import Lead from "../models/leads.js";
import dayjs from "dayjs";
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

const createAgent = async (req, res) => {
  try {
    let isAdmin = req.user && req.user.user_role === "admin";

    const { error } = createAgentValidator.validate(req.body, { abortEarly: false });

    if (error) {
      const messages = error.details.map((err) => err.message.replace(/"/g, ""));
      const message = messages.length === 1 ? messages[0] : "Validation error";
      const extra = messages.length > 1 ? { errors: messages } : undefined;
      return handleResponse(res, 400, message, extra);
    }

    const existingAgent = await Agent.findOne({ email: req.body.email });
    if (existingAgent) {
      return handleResponse(res, 409, "Email already registered.");
    }

    const existingChannelPartner = await ChannelPartner.findOne({ email: req.body.email });
    if (existingChannelPartner) {
      return handleResponse(res, 409, "Email already registered.");
    }

    const filesToUpload = {
      profile_photo: req.files?.profile_photo?.[0]?.buffer || null,
      id_proof: req.files?.id_proof?.[0]?.buffer || null,
    };

    const { profile_photo: profilePhotoUrl, id_proof: idProofUrl } = await uploadFilesToCloudinary(filesToUpload);

    if (!profilePhotoUrl || !idProofUrl) {
      return handleResponse(res, 400, "Profile photo and ID proof are required");
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 7);

    const newAgentData = {
      ...req.body,
      password: hashedPassword,
      profile_photo: profilePhotoUrl,
      id_proof: idProofUrl,
      role: "agent",
      status: isAdmin ? "active" : "inactive",
      createdBy: isAdmin ? req.user._id : null,
    };

    const newAgent = await Agent.create(newAgentData);

    const agentData = newAgent.toObject();
    delete agentData.password;
    delete agentData.__v;

    return handleResponse(res, 201, isAdmin ? "Agent created by admin successfully" : "Agent registered successfully. Awaiting admin approval.", agentData);
  } catch (error) {
    console.error("Error creating agent:", error);
    return handleResponse(res, 500, "Internal Server Error", { error: error.message });
  }
};

const loginAgent = async (req, res) => {
  try {
    const { email, password, mobile_number, otp } = req.body;
    const errorMessages = [];

    if (!email && !mobile_number) errorMessages.push("Email or mobile number is required");
    if (email && !password) errorMessages.push("Password is required");

    if (errorMessages.length > 0) {
      return handleResponse(res, 400, errorMessages.join(", "));
    }

    // Option 1: Email + Password login
    if (email && password) {
      const agent = await Agent.findOne({ email }).select('+password');
      if (!agent) {
        return handleResponse(res, 404, "Agent not found");
      }

      const isMatch = await bcrypt.compare(password, agent.password);
      if (!isMatch) {
        return handleResponse(res, 401, "Invalid email or password");
      }

      if (agent.status !== "active") {
        return handleResponse(res, 403, "Your account has not been verified by the admin. Please wait for admin approval.");
      }

      const token = await signAccessToken(agent._id, "agent", agent.email);
      return handleResponse(res, 200, "Login successful", {
        id: agent._id,
        name: agent.name,
        role: agent.role,
        firm_name: agent.firm_name,
        token
      });
    }

    // Option 2: Mobile number + OTP login
    if (mobile_number && otp) {
      if (otp !== process.env.HARD_CODED_OTP) {
        return handleResponse(res, 400, "Invalid OTP");
      }

      const agent = await Agent.findOne({ mobile_number });
      if (!agent) {
        return handleResponse(res, 404, "Agent not found");
      }

      if (agent.status !== "active") {
        return handleResponse(res, 403, "Your account has not been verified by the admin. Please wait for admin approval.");
      }

      const token = await signAccessToken(agent._id, agent.role, agent.email);
      return handleResponse(res, 200, "Login successful", {
        name: agent.name,
        role: agent.role,
        firm_name: agent.firm_name,
        token
      });
    }

    return handleResponse(res, 400, "Invalid request, provide either email/password or mobile_number/OTP");

  } catch (error) {
    console.error("Error logging in agent:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllAgents = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { q = "", status, page = 1, perPage = 100 } = req.query;

    const matchStage = {
      role: "agent",
    };

    if (status) {
      matchStage.status = status.toLowerCase();
    }

    if (q) {
      const regex = new RegExp(q, "i");

      if (q.toLowerCase() === "active" || q.toLowerCase() === "inactive") {
        matchStage.status = q.toLowerCase();
      } else {
        matchStage.$or = [
          { name: regex },
          { email: regex },
          { mobile_number: regex },
          { firm_name: regex },
          { state: regex },
        ];
      }
    }

    const skip = (page - 1) * perPage;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "leads",
          let: { agentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$assigned_to", "$$agentId"] },
                        { $eq: ["$assigned_to_model", "Agent"] }
                      ]
                    },
                    {
                      $and: [
                        { $eq: ["$created_by", "agent"] },
                        { $eq: ["$created_by_id", "$$agentId"] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: "lead_details",
        },
      },

      {
        $addFields: {
          leads_count: { $size: "$lead_details" }
        }
      },
      {
        $project: {
          password: 0,
          refreshToken: 0,
          // direct_leads: 0,
          __v: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
    ];

    const agents = await Agent.aggregate(pipeline);

    const totalItems = await Agent.countDocuments(matchStage);

    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Agents fetched successfully", {
      results: agents,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: agents.length,
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllAgentsForChannelPartner = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "channel_partner") {
      return handleResponse(res, 403, "Access denied. Channel partners only.");
    }

    const { q = "", status, page = 1, perPage = 100 } = req.query;

    const matchStage = {
      role: "agent",
      deleted: { $ne: true },
      createdBy: req.user._id,
    };

    if (status) {
      matchStage.status = status.toLowerCase();
    }

    if (q) {
      const regex = new RegExp(q, "i");

      if (q.toLowerCase() === "active" || q.toLowerCase() === "inactive") {
        matchStage.status = q.toLowerCase();
      } else {
        matchStage.$or = [
          { name: regex },
          { email: regex },
          { mobile_number: regex },
          { firm_name: regex },
          { state: regex },
        ];
      }
    }

    const skip = (page - 1) * perPage;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "leads",
          let: { agentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$assigned_to", "$$agentId"] },
                    { $eq: ["$assigned_to_model", "Agent"] },
                  ],
                },
              },
            },
          ],
          as: "direct_leads",
        },
      },
      {
        $addFields: {
          leads_count: { $size: "$direct_leads" },
        },
      },
      {
        $project: {
          password: 0,
          refreshToken: 0,
          direct_leads: 0,
          __v: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(perPage) },
    ];

    const agents = await Agent.aggregate(pipeline);

    const totalItems = await Agent.countDocuments(matchStage);
    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Agents fetched successfully", {
      results: agents,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: agents.length,
    });
  } catch (error) {
    console.error("Error fetching agents for channel partner:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAgentById = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { id } = req.params;

    const agent = await Agent.findById(id).select("-password -refreshToken -__v");

    if (!agent || agent.role !== "agent") {
      return handleResponse(res, 404, "Agent not found");
    }

    return handleResponse(res, 200, "Agent fetched successfully", agent.toObject());
  } catch (error) {
    console.error("Error fetching agent by ID:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const deleteAgentById = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid Agent Id");
    }

    const agent = await Agent.findById(id);
    if (!agent || agent.role !== "agent") {
      return handleResponse(res, 404, "Agent not found");
    }


    if (agent.deleted === true) {
      return handleResponse(res, 400, "Agent already deleted");
    }

    agent.deleted = true;
    agent.deletedAt = new Date();
    await agent.save();

    return handleResponse(res, 200, "Agent deleted successfully");
  } catch (error) {
    console.error("Error deleting agent:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || role !== "agent") {
      return handleResponse(res, 403, "Unauthorized access. Only agents can fetch this detail.");
    }

    // ✅ Get agent profile
    const agent = await Agent.findById(userId)
      .select("-createdAt -updatedAt -__v -deleted -deletedAt -last_seen");

    if (!agent) {
      return handleResponse(res, 404, "Agent not found");
    }

    // ✅ Count & summarize leads using aggregation
    const leads = await Lead.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { created_by_id: new mongoose.Types.ObjectId(String(userId)) },
                { assigned_to: new mongoose.Types.ObjectId(String(userId)) },
                { declined_by: new mongoose.Types.ObjectId(String(userId)) },
              ],
            },
            {
              $or: [
                { is_broadcasted: { $ne: true } },
                { lead_accepted_by: new mongoose.Types.ObjectId(String(userId)) },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // ✅ Convert to key-value format
    const statusBreakdown = leads.reduce((acc, curr) => {
      acc.totalItems = (acc.totalItems || 0) + curr.count;
      const statusKey = curr._id?.toLowerCase() || "unknown";
      acc[statusKey] = curr.count;
      return acc;
    }, {});

    // ✅ Count leads accepted from broadcast
    const broadcastCount = await Lead.countDocuments({
      is_broadcasted: false,
      lead_accepted_by: new mongoose.Types.ObjectId(String(userId)),
    });

    // ✅ Response
    return handleResponse(res, 200, "Agent profile fetched successfully", {
      ...agent.toObject(),
      leads_summary: statusBreakdown,
      broadcast_leads_count: broadcastCount,
    });
  } catch (error) {
    console.error("Error in me:", error);
    return handleResponse(res, 500, "Server error");
  }
};

const addFollowUp = async (req, res) => {
  try {
    const { leadId } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return handleResponse(res, 400, "Invalid lead ID");
    }

    const { error, value } = followUpSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return handleResponse(res, 400, error.details[0].message);
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return handleResponse(res, 404, "Lead not found");
    }

    // Convert follow_up_date string to Date object, if present
    let followUpDateObj = undefined;
    if (value.follow_up_date) {
      followUpDateObj = dayjs(value.follow_up_date, "DD/MM/YYYY").toDate();
    }

    const followUpData = {
      ...value,
      follow_up_date: followUpDateObj, // save Date object, not string
      added_by: {
        id: user.id,
        name: user.username,
        role: user.user_role,
      },
      created_at: new Date(),
    };

    if (!Array.isArray(lead.follow_ups)) {
      lead.follow_ups = [];
    }

    lead.follow_ups.push(followUpData);
    await lead.save();

    return handleResponse(res, 201, "Follow-up added successfully", { ...followUpData });
  } catch (err) {
    console.error("Error in addFollowUp:", err.message);
    return handleResponse(res, 500, "Server error", { error: err.message });
  }
};

const getMyFollowUps = async (req, res) => {
  try {
    const user = req.user;

    const leads = await Lead.find({
      "follow_ups.added_by.id": user.id,
    }).select("name follow_ups");

    const myFollowUps = [];

    leads.forEach((lead) => {
      lead.follow_ups.forEach((followUp) => {
        if (followUp.added_by?.id?.toString() === user.id.toString()) {
          myFollowUps.push({
            lead_name: lead.name,
            lead_id: lead._id,
            task: followUp.task,
            notes: followUp.notes,
            follow_up_date: followUp.follow_up_date,
          });
        }
      });
    });

    return handleResponse(res, 200, "Follow-ups fetched successfully", { results: myFollowUps });
  } catch (err) {
    console.error("Error in getMyFollowUps:", err.message);
    return handleResponse(res, 500, "Server error", { error: err.message });
  }
};

const addPersonalNotes = async (req, res) => {
  try {
    const { notes } = req.body; // notes = "some text"
    const agentId = req.params?.id || req.user?.id;

    if (!notes) {
      return handleResponse(res, 400, "Notes is required");
    }

    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      {
        $push: { notes: { message: notes } }
      },
      { new: true }
    );

    if (!updatedAgent) {
      return handleResponse(res, 404, "Agent not found");
    }

    return handleResponse(res, 201, "Note added successfully");
  } catch (error) {
    console.error("Error creating note", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getAllAgentNotes = async (req, res) => {
  try {
    const agentId = req.user?.id;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "Unauthorized: Agent ID missing in token",
      });
    }

    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(agentId),
          deleted: false
        }
      },
      {
        // Sort notes array descending by createdAt
        $addFields: {
          notes: {
            $sortArray: {
              input: "$notes",
              sortBy: { createdAt: -1 }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          notes: {
            $map: {
              input: "$notes",
              as: "note",
              in: {
                _id: "$$note._id",
                message: "$$note.message",
                createdAt: "$$note.createdAt"
              }
            }
          }
        }
      }
    ];

    const result = await Agent.aggregate(pipeline);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Agent not found or no notes available"
      });
    }

    return res.status(200).json({
      success: true,
      error: false,
      message: "Agent notes fetched successfully",
      notes: result[0].notes
    });
  } catch (error) {
    console.error("Error fetching agent notes", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: "Internal Server Error"
    });
  }
};

export const agent = {
  createAgent,
  loginAgent,
  getAllAgents,
  getAllAgentsForChannelPartner,
  getAgentById,
  deleteAgentById,
  me,
  addFollowUp,
  getMyFollowUps,
  addPersonalNotes,
  getAllAgentNotes
};
