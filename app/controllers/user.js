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
        const partners = await ChannelPartner.find({ role: "channel_partner" }).select(
            "_id name username email mobile_number role"
        );

        return handleResponse(res, 200, "Channel Partners fetched successfully", { results: partners });
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
        const partner = await ChannelPartner.findById(id).select(
            "_id name username email mobile_number role"
        );

        if (!partner) {
            return handleResponse(res, 404, "Channel Partner not found");
        }

        return handleResponse(res, 200, "Channel Partner fetched successfully", { partner });
    } catch (error) {
        console.error("Error fetching channel partner by ID:", error);
        return handleResponse(res, 500, "Internal Server Error");
    }
};

export const admin = {
    createAdmin,
    loginAdmin,
    getAllChannelPartners,
    getChannelPartnerById
}