
// app/controllers/chatController.js
import Chat from "../models/chat.js";
import { handleResponse } from "../utils/helper.js";
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import User from "../models/user.js";

const createChat = async (req, res) => {
  try {
    const io = req.io;
    if (!io) console.log("No socket io instance found");

    const senderId = req.user.id;
    const senderRole = req.user.user_role || req.user.role;
    const receiverId = req.params.receiverId;
    const { message } = req.body;

    if (!message || !receiverId) {
      return handleResponse(res, 400, "Message and receiverId required");
    }

    let conversation = await Chat.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = new Chat({
        participants: [senderId, receiverId],
        messages: [],
      });
    }

    const newMessage = {
      senderId,
      message,
      senderRole,
      timestamp: new Date(),
    };

    conversation.messages.push(newMessage);

    await conversation.save();

    if (senderRole === "admin") {
      io.to(receiverId).emit("receive-message", newMessage);
    } else {
      io.to("admins").emit("receive-message", newMessage);
    }

    const responseData = {
      _id: conversation._id,
      participants: conversation.participants,
      latestMessage: newMessage,

      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    return handleResponse(res, 201, "Message added successfully", responseData);
  } catch (error) {
    console.error("Chat creation error:", error);
    return handleResponse(res, 500, "Internal server error", { error: error.message });
  }
};

//all informations including chat
const getAllChatHistory = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const userRole = req.user.user_role || req.user.role;

    const { page = 1, perPage = 100 } = req.query;
    const skip = (page - 1) * perPage;

    const matchStage = {};

    if (userRole === "admin") {
    } else if (userRole === "agent" || userRole === "channel_partner") {
      matchStage.participants = loggedInUserId;
    } else {
      return handleResponse(res, 403, "Unauthorized access");
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: Number(perPage) },

      {
        $lookup: {
          from: "users",
          localField: "participants",
          foreignField: "_id",
          as: "userParticipants"
        }
      },
      {
        $lookup: {
          from: "agents",
          localField: "participants",
          foreignField: "_id",
          as: "agentParticipants"
        }
      },
      {
        $lookup: {
          from: "channelpartners",
          localField: "participants",
          foreignField: "_id",
          as: "cpParticipants"
        }
      },
      {
        $addFields: {
          participantsInfo: {
            $concatArrays: ["$userParticipants", "$agentParticipants", "$cpParticipants"]
          },
          latestMessage: { $arrayElemAt: ["$messages", -1] }
        }
      },
      {
        $project: {
          messages: 1,
          updatedAt: 1,
          latestMessage: 1,
          participants: {
            $map: {
              input: "$participantsInfo",
              as: "p",
              in: {
                _id: "$$p._id",
                name: "$$p.name",
                username: "$$p.username",
                email: "$$p.email",
                role: "$$p.role",
                profile_photo: "$$p.profile_photo",
              }
            }
          }
        }
      }
    ];

    const chats = await Chat.aggregate(pipeline);

    const totalItems = await Chat.countDocuments(matchStage);
    const totalPages = Math.ceil(totalItems / perPage);

    return handleResponse(res, 200, "Chat history fetched successfully", {
      results: chats,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: chats.length,
    });
  } catch (error) {
    console.error("Error in getAllChatHistory:", error);
    return handleResponse(res, 500, "Internal server error", { error: error.message });
  }
};

const getChatHistoryOfAgentCPById = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.role || req.user.user_role;
    const targetUserId = req.params.userId;

    let allowed = false;      // Admin: can fetch chat with any user and  Agent/CP: can fetch only their chat with admin

    if (requesterRole === "admin") {
      allowed = true;
    } else if (["agent", "channel_partner"].includes(requesterRole)) {
      const adminUser = await User.findOne({ _id: targetUserId, role: "admin" });
      if (adminUser) {
        allowed = true;
      }
    }

    if (!allowed) {
      return handleResponse(res, 403, "Access denied. You are not authorized to view this chat.");
    }

    const chat = await Chat.findOne({
      participants: { $all: [requesterId, targetUserId] },
    }).lean();

    if (!chat) {
      return handleResponse(res, 404, "No chat found with this user.");
    }

    const agent = await Agent.findById(targetUserId).select("name profile_photo last_seen");

    let status = "offline";
    if (agent.last_seen === null) {
      status = "online";
    } else {
      status = `last seen at ${agent.last_seen.toISOString()}`; // or use moment.js for relative time
    }
    return handleResponse(res, 200, "Chat history fetched", {
      _id: chat._id,
      participants: chat.participants,
      status: status,
      messages: chat.messages,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      // participantInfo: {
      //   _id: agent._id,
      //   name: agent.name,
      //   profile_photo: agent.profile_photo,
      // }
    });

  } catch (error) {
    console.error("Error in getChatHistoryOfAgentCPById:", error);
    return handleResponse(res, 500, "Internal server error", { error: error.message });
  }
};

const getAllChatParticipantsWithLastMessage = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const userRole = req.user.user_role || req.user.role;

    const { page = 1, perPage = 100 } = req.query;
    const skip = (page - 1) * perPage;

    const matchStage = {};

    if (userRole === "admin") {
    } else if (userRole === "agent" || userRole === "channel_partner") {
      matchStage.participants = loggedInUserId;
    } else {
      return handleResponse(res, 403, "Unauthorized access");
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: Number(perPage) },

      {
        $addFields: {
          lastMessage: { $arrayElemAt: ["$messages", -1] }
        }
      },

      {
        $lookup: {
          from: "users",
          localField: "participants",
          foreignField: "_id",
          as: "userParticipants"
        }
      },
      {
        $lookup: {
          from: "agents",
          localField: "participants",
          foreignField: "_id",
          as: "agentParticipants"
        }
      },
      {
        $lookup: {
          from: "channelpartners",
          localField: "participants",
          foreignField: "_id",
          as: "cpParticipants"
        }
      },
      {
        $addFields: {
          participantsInfo: {
            $concatArrays: ["$agentParticipants", "$cpParticipants"]
          }
        }
      },
      {
        $project: {
          lastMessageText: "$lastMessage.message",
          updatedAt: 1,
          participants: {
            $map: {
              input: "$participantsInfo",
              as: "p",
              in: {
                _id: "$$p._id",
                name: { $ifNull: ["$$p.name", "$$p.username"] },
                profile_photo: "$$p.profile_photo"
              }
            }
          }
        }
      }
    ];

    const chats = await Chat.aggregate(pipeline);
    const totalItems = await Chat.countDocuments(matchStage);
    const totalPages = Math.ceil(totalItems / perPage);

    const allParticipants = [];

    chats.forEach(chat => {
      const { lastMessageText, updatedAt } = chat;
      chat.participants.forEach(participant => {
        allParticipants.push({
          ...participant,
          lastMessage: lastMessageText,
          updatedAt
        });
      });
    });

    const uniqueMap = new Map();

    allParticipants.forEach(p => {
      const idStr = p._id.toString();
      if (!uniqueMap.has(idStr)) {
        uniqueMap.set(idStr, p);
      } else {
        const existing = uniqueMap.get(idStr);
        if (new Date(p.updatedAt) > new Date(existing.updatedAt)) {
          uniqueMap.set(idStr, p);
        }
      }
    });

    const uniqueParticipants = Array.from(uniqueMap.values());

    return handleResponse(res, 200, "Participants fetched successfully", {
      participants: uniqueParticipants,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage: chats.length
    });
  } catch (error) {
    console.error("Error in Get All Chat Participants With Last Message:", error);
    return handleResponse(res, 500, "Internal server error", { error: error.message });
  }
};

export const chats = {
  createChat,
  getAllChatHistory,
  getChatHistoryOfAgentCPById,
  getAllChatParticipantsWithLastMessage
};