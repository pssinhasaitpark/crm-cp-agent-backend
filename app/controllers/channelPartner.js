//app/controllers/channelPartner.js
import bcrypt from "bcryptjs";
import ChannelPartner from "../models/channelPartner.js";
import Agent from "../models/agent.js";
import { handleResponse } from "../utils/helper.js";
import Lead from "../models/leads.js";
import { createChannelPartnerValidator } from "../validators/channelPartner.js";
import { signAccessToken } from "../middlewares/jwtAuth.js";
import { uploadFilesToCloudinary } from "../middlewares/multer.js";
import mongoose from 'mongoose';

const createChannelPartner = async (req, res) => {
  try {
    let isAdmin = req.user && req.user.user_role === "admin";

    const { error } = createChannelPartnerValidator.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const messages = error.details.map((err) => err.message.replace(/"/g, ""));
      const message = messages.length === 1 ? messages[0] : "Validation error";
      const extra = messages.length > 1 ? { errors: messages } : undefined;
      return handleResponse(res, 400, message, extra);
    }

    const existingPartner = await ChannelPartner.findOne({ email: req.body.email });
    if (existingPartner) {
      return handleResponse(res, 409, "Email already registered.");
    }

    const existingAgent = await Agent.findOne({ email: req.body.email });
    if (existingAgent) {
      return handleResponse(res, 409, "Email already registered.");
    }

    const filesToUpload = {
      profile_photo: req.files?.profile_photo?.[0]?.buffer || null,
      id_proof: req.files?.id_proof?.[0]?.buffer || null,
    };

    const { profile_photo: profilePhotoUrl, id_proof: idProofUrl } =
      await uploadFilesToCloudinary(filesToUpload);

    if (!profilePhotoUrl || !idProofUrl) {
      return handleResponse(res, 400, "Profile photo and ID proof are required");
    }


    const hashedPassword = await bcrypt.hash(req.body.password, 7);

    const newPartner = await ChannelPartner.create({
      ...req.body,
      password: hashedPassword,
      profile_photo: profilePhotoUrl,
      id_proof: idProofUrl,
      role: "channel_partner",
      status: isAdmin ? "active" : "inactive",
    });

    const partnerData = newPartner.toObject();
    delete partnerData.password;
    delete partnerData.__v;

    return handleResponse(res, 201, isAdmin ? "Channel Partner created by admin successfully" : "Channel Partner registered successfully. Awaiting admin approval.", partnerData);
  } catch (error) {
    console.log("Error Creating Channel-Partner", error)
    return handleResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const loginChannelPartner = async (req, res) => {
  try {
    const { secret_key, email, password, mobile_number, otp } = req.body;
    const errorMessages = [];

    if (!email && !mobile_number) errorMessages.push("Email or mobile number is required");
    if (email && !password) errorMessages.push("Password is required");

    if (errorMessages.length > 0) {
      return handleResponse(res, 400, errorMessages.join(", "));
    }

    // Option 1: Email + Password login
    if (email && password) {
      const partner = await ChannelPartner.findOne({ email }).select('+password');
      if (!partner) {
        return handleResponse(res, 404, "Channel Partner not found");
      }

      // ✅ Check if account is active
      if (partner.status !== "active") {
        return handleResponse(res, 403, "Your account has not been verified by the admin. Please wait for admin approval.");
      }

      // if (partner.deleted == "true") {
      //   return handleResponse(res, 403, "Your account has been deleted by the admin. Please contact with admin.");
      // }

      const isMatch = await bcrypt.compare(password, partner.password);
      if (!isMatch) {
        return handleResponse(res, 401, "Invalid email or password");
      }

      const token = await signAccessToken(partner._id, "channel_partner", partner.email);
      return handleResponse(res, 200, "Login successful", {
        name: partner.name,
        role: partner.role,
        firm_name: partner.firm_name,
        token
      });
    }

    // Option 2: Mobile number + OTP login
    if (mobile_number && otp) {
      if (otp !== process.env.HARD_CODED_OTP) {
        return handleResponse(res, 400, "Invalid OTP");
      }

      const partner = await ChannelPartner.findOne({ mobile_number });
      if (!partner) {
        return handleResponse(res, 404, "Channel Partner not found");
      }

      // ✅ Check if account is active
      if (partner.status !== "active") {
        return handleResponse(
          res,
          403,
          "Your account has not been verified by the admin. Please wait for admin approval."
        );
      }

      const token = await signAccessToken(partner._id, partner.role, partner.email);
      return handleResponse(res, 200, "Login successful", { token });
    }

    return handleResponse(res, 400, "Invalid request, provide either email/password or mobile_number/OTP");

  } catch (error) {
    console.error("Error logging in channel partner:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

//leads_count issue only agent, not CP
/*
const getChannelPartnerLeadCount = async (channelPartnerId) => {
  const cpObjectId = new mongoose.Types.ObjectId(String(channelPartnerId));

  const pipeline = [
    {
      $match: {
        $or: [
          // Leads jo channel partner ne create ki hain
          { created_by_id: cpObjectId },
          // Ya leads jo assigned_to kisi agent hain, aur wo leads channel partner ne create ki hain
          {
            assigned_to_model: "Agent",
            created_by_id: cpObjectId,
          },
        ],
      },
    },
    {
      $count: "totalLeads",
    },
  ];

  const result = await Lead.aggregate(pipeline);

  return result.length > 0 ? result[0].totalLeads : 0;
};
*/

//here lead_count correct for CP
const getChannelPartnerLeadCount = async (channelPartnerId) => {
  const cpObjectId = new mongoose.Types.ObjectId(String(channelPartnerId));

  const pipeline = [
    {
      $match: {
        $or: [
          { created_by_id: cpObjectId },

          {
            assigned_to_model: "Agent",
            created_by_id: cpObjectId,
          },

          {
            assigned_to: cpObjectId,
            assigned_to_model: "ChannelPartner",
          },
        ],
      },
    },
    {
      $count: "totalLeads",
    },
  ];

  const result = await Lead.aggregate(pipeline);

  return result.length > 0 ? result[0].totalLeads : 0;
};

const getAllChannelPartners = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { q = "", status, page = 1, perPage = 100 } = req.query;

    const matchStage = {
      role: "channel_partner",
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
          { role: regex },
        ];
      }
    }

    const skip = (page - 1) * perPage;

    const partners = await ChannelPartner.find(matchStage)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(perPage))
      .lean();

    const totalItems = await ChannelPartner.countDocuments(matchStage);

    const totalPages = Math.ceil(totalItems / perPage);

    const partnersWithLeads = await Promise.all(
      partners.map(async (partner) => {
        const leadsCount = await getChannelPartnerLeadCount(partner._id);
        return {
          ...partner,
          leadsCount,
        };
      })
    );

    const totalItemsOnCurrentPage = partners.length;

    return handleResponse(res, 200, "Channel Partners fetched successfully", {
      results: partnersWithLeads,
      totalItems,
      currentPage: Number(page),
      totalPages,
      totalItemsOnCurrentPage,
    });
  } catch (error) {
    console.error("Error fetching channel partners:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const getChannelPartnerById = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid Channel Partner Id");
    }

    const partner = await ChannelPartner.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(String(id)) } },
      {
        $project: {
          _id: 1,
          name: 1,
          name: 1,
          email: 1,
          mobile_number: 1,
          firm_name: 1,
          state: 1,
          role: 1,
          role: 1,
          deleted: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    if (!partner || partner.length === 0) {
      return handleResponse(res, 404, "Channel Partner not found");
    }

    return handleResponse(res, 200, "Channel Partner fetched successfully", partner[0]);

  } catch (error) {
    console.error("Error fetching channel partner by ID:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const deleteChannelPartnerById = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid Channel Partner Id");
    }

    const partner = await ChannelPartner.findById(id);

    if (!partner) {
      return handleResponse(res, 404, "Channel Partner not found");
    }

    if (partner.deleted) {
      return handleResponse(res, 400, "Channel Partner is already deleted");
    }

    partner.deleted = true;
    partner.deletedAt = new Date();
    await partner.save();

    return handleResponse(res, 200, "Channel Partner deleted successfully", partner.toObject());
  } catch (error) {
    console.error("Error deleting channel partner:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if(!userId || role!=="channel_partner") {
      return handleResponse(res, 403, "Unauthorized access. Only channel partner can fetch this detail.")
    }

    const cp = await ChannelPartner.findById(userId).select("-createdAt -updatedAt -__v -deleted -deletedAt");

    if(!cp) {
      return handleResponse(res, 404, "Channel Partner Not found");
    }

    return handleResponse(res, 200, `Channel Partner Detailed Fetched Successfully`, cp.toJSON());

  } catch (error) {
    console.error("Error in Getting Details", error);
    return handleResponse(res, 500, `Internal Server Error`);
  }
}

export const channelPartner = {
  createChannelPartner,
  loginChannelPartner,
  getAllChannelPartners,
  getChannelPartnerById,
  deleteChannelPartnerById,
  me
}