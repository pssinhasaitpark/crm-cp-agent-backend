// app/controllers/user.js
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import ChannelPartner from "../models/channelPartner.js";
import { handleResponse } from "../utils/helper.js";
import { createAdminValidators, loginValidators } from "../validators/user.js";
import { signAccessToken } from "../middlewares/jwtAuth.js";
import mongoose from "mongoose";

const createAdmin = async (req, res) => {
    try {
        const { error } = createAdminValidators.validate(req.body, { abortEarly: false });
        if (error) {
            const messages = error.details.map((err) => err.message);
            return handleResponse(res, 400, messages.join(", "));
        }

        const { username, email, password, mobile_number } = req.body;

        const existingAdmin = await User.findOne({ role: "admin" });
        if (existingAdmin) {
            return handleResponse(res, 400, "Admin already exists. Only one admin is allowed.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = new User({
            username,
            email,
            password: hashedPassword,
            mobile_number,
            role: "admin",
        });

        await newAdmin.save();

        const adminResponse = {
            id: newAdmin._id,
            username: newAdmin.username,
            email: newAdmin.email,
            mobile_number: newAdmin.mobile_number,
            role: newAdmin.role,
        };

        return handleResponse(res, 201, "Admin created successfully", adminResponse);
    } catch (error) {
        console.error("Error creating admin:", error);
        return handleResponse(res, 500, "Internal Server Error");
    }
};

const loginAdmin = async (req, res) => {
    try {
        // ✅ Validate input with Joi (collect all errors)
        const { error } = loginValidators.validate(req.body, { abortEarly: false });
        if (error) {
            const messages = error.details.map((err) => err.message);
            return handleResponse(res, 400, messages.join(", "));
        }

        const { email, password } = req.body;

        // ✅ Check if admin exists
        const foundAdmin = await User.findOne({ email, role: "admin" });
        if (!foundAdmin) {
            return handleResponse(res, 401, "Invalid email or password");
        }

        // ✅ Compare password
        const isMatch = await bcrypt.compare(password, foundAdmin.password);
        if (!isMatch) {
            return handleResponse(res, 401, "Invalid email or password");
        }

        // ✅ Generate JWT token
        const token = signAccessToken(foundAdmin._id, foundAdmin.role, foundAdmin.email);

        // ✅ Safe response (no password)
        const adminResponse = {
            id: foundAdmin._id,
            username: foundAdmin.username,
            email: foundAdmin.email,
            mobile_number: foundAdmin.mobile_number,
            role: foundAdmin.role,
            token,
        };

        return handleResponse(res, 200, "Login successful", adminResponse);
    } catch (error) {
        console.error("Login error:", error);
        return handleResponse(res, 500, "Internal server error");
    }
};

const getAllChannelPartners = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { page = 1, limit = 10, q = "", status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let matchStage = {
      agent_type: { $in: ["agent", "channel_partner"] },
    };

    // ✅ If status is given explicitly
    if (status) {
      matchStage.status = status.toLowerCase();
    }

    // ✅ Text search
    if (q) {
      const regex = new RegExp(q, "i");

      // Agar q = active/inactive hai → exact status filter
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
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const partners = await ChannelPartner.aggregate(pipeline);
    const totalItem = await ChannelPartner.countDocuments(matchStage);

    return handleResponse(res, 200, "Channel Partners fetched successfully", {
      results: partners,
      totalItem,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItem / parseInt(limit)),
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
      { $match: { _id: new mongoose.Types.ObjectId(String(id))} },
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

const approveChannelPartnerStatusById = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Access denied. Admins only.");
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return handleResponse(res, 400, "Invalid Channel Partner Id");
    }

    if (![ "active", "inactive"].includes(status)) {
      return handleResponse(res, 400, `Status must be 'active' or 'inactive'`);
    }

    let updatedPartner = await ChannelPartner.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true, projection: { password: 0 } }
    );

    if (!updatedPartner) {
      return handleResponse(res, 404, "Channel Partner not found");
    }

    return handleResponse(
      res,
      200,
      `Channel Partner ${status} successfully`,
      updatedPartner.toObject()   // ensures clean JSON without mongoose internals
    );

  } catch (error) {
    console.error("Error approving channel partner:", error);
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

    // Step 1: Find the partner first
    const partner = await ChannelPartner.findById(id);

    if (!partner) {
      return handleResponse(res, 404, "Channel Partner not found");
    }

    // Step 2: Check if already deleted
    if (partner.deleted) {
      return handleResponse(res, 400, "Channel Partner is already deleted");
    }

    // Step 3: Perform soft delete
    partner.deleted = true;
    partner.deletedAt = new Date();
    await partner.save();

    return handleResponse(res, 200, "Channel Partner deleted successfully", partner.toObject());
  } catch (error) {
    console.error("Error deleting channel partner:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};


export const admin = {
    createAdmin,
    loginAdmin,
    getAllChannelPartners,
    getChannelPartnerById,
    approveChannelPartnerStatusById,
    deleteChannelPartnerById
}