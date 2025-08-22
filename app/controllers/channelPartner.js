//app/controllers/channelPartner.js
import bcrypt from "bcryptjs";
import ChannelPartner from "../models/channelPartner.js";
import { handleResponse } from "../utils/helper.js";
import { createChannelPartnerValidator } from "../validators/channelPartner.js";
import { signAccessToken } from "../middlewares/jwtAuth.js"; 

const createChannelPartner = async (req, res) => {
  try {
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Only admin can create a channel partner");
    }

    const { error } = createChannelPartnerValidator.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((err) => err.message.replace(/"/g, ""));
      return handleResponse(res, 400, messages.join(", "));
    }

    const { name, email, password, mobile_number } = req.body;

    const existingPartner = await ChannelPartner.findOne({ email });
    if (existingPartner) {
      return handleResponse(res, 400, "Channel Partner already exists with this email");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newPartner = new ChannelPartner({
      name,
      email,
      password: hashedPassword,
      mobile_number,
    });

    await newPartner.save();

    const partnerResponse = {
      id: newPartner._id,
      name: newPartner.name,
      email: newPartner.email,
      mobile_number: newPartner.mobile_number,
      role: newPartner.role,
    };

    return handleResponse(res, 201, "Channel Partner created successfully", partnerResponse);
  } catch (error) {
    console.error("Error creating channel partner:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

const loginChannelPartner = async (req, res) => {
  try {
    const { secret_key, email, password, mobile_number, otp } = req.body;
    const errorMessages = [];

    // Collect validation errors
    if (!secret_key) errorMessages.push("Secret key is missing");
    if (!email && !mobile_number) errorMessages.push("Email or mobile number is required");
    if (email && !password) errorMessages.push("Password is required");
    if (mobile_number && !otp) errorMessages.push("OTP is required");

    if (errorMessages.length > 0) {
      return handleResponse(res, 400, errorMessages.join(", "));
    }

    // Check secret key
    if (secret_key !== process.env.HARD_CODED_SECRET_KEY) {
      return handleResponse(res, 403, "Secret key is invalid");
    }

    // Option 1: Email + Password login
    if (email && password) {
      const partner = await ChannelPartner.findOne({ email }).select('+password'); // Ensure password is included
      if (!partner) {
        return handleResponse(res, 404, "Channel Partner not found");
      }

      if (!partner.password) {
        return handleResponse(res, 500, "Partner password not set in database");
      }

      const isMatch = await bcrypt.compare(password, partner.password);
      if (!isMatch) {
        return handleResponse(res, 401, "Invalid email or password");
      }

      const token = await signAccessToken(partner._id, partner.role, partner.email);
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

      const token = await signAccessToken(partner._id, partner.role, partner.email);
      return handleResponse(res, 200, "Login successful", { token });
    }

    return handleResponse(res, 400, "Invalid request, provide either email/password or mobile_number/OTP");

  } catch (error) {
    console.error("Error logging in channel partner:", error);
    return handleResponse(res, 500, "Internal Server Error");
  }
};

export const channelPartner = {
    createChannelPartner,
    loginChannelPartner
}