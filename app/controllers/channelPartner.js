//app/controllers/channelPartner.js
import bcrypt from "bcryptjs";
import ChannelPartner from "../models/channelPartner.js";
import { handleResponse } from "../utils/helper.js";
import { createChannelPartnerValidator } from "../validators/channelPartner.js";
import { signAccessToken } from "../middlewares/jwtAuth.js";
import { uploadMultipleToCloudinary } from "../middlewares/multer.js";
import mongoose from 'mongoose';

const createChannelPartner = async (req, res) => {
  try {
    let isAdmin = req.user && req.user.user_role === "admin";

    const { error } = createChannelPartnerValidator.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return handleResponse(res, 400, "Validation error", {
        errors: error.details.map((err) => err.message.replace(/"/g, "")),
      });
    }

    const existingPartner = await ChannelPartner.findOne({ email: req.body.email });
    if (existingPartner) {
      return handleResponse(res, 409, "Email already registered");
    }

    const filesToUpload = {
      profile_photo: req.files?.profile_photo?.[0]?.buffer || null,
      id_proof: req.files?.id_proof?.[0]?.buffer || null,
    };

    const { profile_photo: profilePhotoUrl, id_proof: idProofUrl } =
      await uploadMultipleToCloudinary(filesToUpload);

    if (!profilePhotoUrl || !idProofUrl) {
      return handleResponse(res, 400, "Profile photo and ID proof are required");
    }


    const hashedPassword = await bcrypt.hash(req.body.password, 7);

    const newPartner = await ChannelPartner.create({
      ...req.body,
      password: hashedPassword,
      profile_photo: profilePhotoUrl,
      id_proof: idProofUrl,
      agent_type: "channel_partner",
      status: isAdmin ? "active" : "inactive",
    });

    const partnerData = newPartner.toObject();
    delete partnerData.password;
    delete partnerData.__v;

    return handleResponse(res, 201, isAdmin ? "Channel Partner created by admin successfully" : "Channel Partner registered successfully. Awaiting admin approval.",  partnerData );
  } catch (error) {
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
      return handleResponse(res, 200, "Login successful", { token });
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

const getAllChannelPartners = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { q = "", status } = req.query;

    let matchStage = {
      agent_type: { $in: ["agent", "channel_partner"] },
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
          { agent_type: regex },
        ];
      }
    }

    const pipeline = [
      { $match: matchStage },
      {
        $project: {
          password: 0,
          refreshToken: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const partners = await ChannelPartner.aggregate(pipeline);
    const totalItem = partners.length;

    return handleResponse(res, 200, "Channel Partners fetched successfully", {
      results: partners,
      totalItem,
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
          agent_type: 1,
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

export const channelPartner = {
  createChannelPartner,
  loginChannelPartner,
  getAllChannelPartners,
  getChannelPartnerById,
  deleteChannelPartnerById
}