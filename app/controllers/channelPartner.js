//app/controllers/channelPartner.js
import bcrypt from "bcryptjs";
import ChannelPartner from "../models/channelPartner.js";
import { handleResponse } from "../utils/helper.js";
import { createChannelPartnerValidator } from "../validators/channelPartner.js";
import { signAccessToken } from "../middlewares/jwtAuth.js";

const createChannelPartner = async (req, res) => {
  try {
    let isAdmin = false;

    if (req.user && req.user.user_role === "admin") {
      isAdmin = true;
    }

    // ✅ Extract file URLs
    const profilePhotoUrl = req.files?.profile_photo?.[0]?.path || null;
    const idProofUrl = req.files?.id_proof?.[0]?.path || null;

    // Joi validation
    const { error } = createChannelPartnerValidator.validate(
      { ...req.body, profile_photo: profilePhotoUrl, id_proof: idProofUrl },
      { abortEarly: false }
    );

    if (error) {
      const messages = error.details.map((err) => err.message.replace(/"/g, ""));
      return handleResponse(res, 400, messages.join(", "));
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const newPartner = new ChannelPartner({
      ...req.body,
      password: hashedPassword,
      profile_photo: profilePhotoUrl,
      id_proof: idProofUrl,
      status: isAdmin ? "active" : "inactive", // 👈 set status based on creator
    });

    await newPartner.save();

    const partnerData = newPartner.toObject();
    delete partnerData.password;
    delete partnerData.__v;

    return handleResponse(
      res,
      201,
      isAdmin
        ? "Channel Partner created by admin successfully"
        : "Channel Partner registered successfully. Awaiting admin approval.",
      partnerData
    );
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return handleResponse(
        res,
        400,
        `${field} already exists. Please use another ${field}.`
      );
    }
    return handleResponse(res, 500, "Internal Server Error");
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

export const channelPartner = {
  createChannelPartner,
  loginChannelPartner
}