import jwt from "jsonwebtoken";
import User from '../models/user.js';
import Agent from "../models/agent.js";
import ChannelPartner from "../models/channelPartner.js";
import crypto from "crypto";
import { handleResponse } from "../utils/helper.js";

export const generateToken = (userId, user_role, userEmail, secret, expiresIn = process.env.EXPIRATION_TIME) => {
  return new Promise((resolve, reject) => {
    const payload = {
      aud: "parkhya.in",
      user_id: userId,
      user_role: user_role,
      email: userEmail,
    };

    const options = {
      subject: `${userId}`,
      expiresIn,
    };

    jwt.sign(payload, secret, options, (err, token) => {
      if (err) reject(err);
      resolve(token);
    });
  });
};

export const signAccessToken = (user_id, user_role, email) => {
  return jwt.sign(
    { user_id, user_role, email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.EXPIRATION_TIME || "7d" }
  );
};

export const signResetToken = ({ email, userId, role }) => {
  return new Promise((resolve, reject) => {
    const payload = { email, userId, role };
    const options = { expiresIn: process.env.EXPIRATION_TIME || '1h' };

    jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, options, (err, token) => {
      if (err) reject(err);
      resolve(token);
    });
  });
};

export const encryptToken = (token) => {
  const key = crypto.createHash("sha256").update(process.env.ACCESS_TOKEN_SECRET).digest();

  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    key,
    Buffer.from(process.env.ACCESS_TOKEN_SECRET).slice(0, 16)
  );
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};

export const decryptToken = (encryptedToken) => {
  const key = crypto.createHash("sha256").update(process.env.ACCESS_TOKEN_SECRET).digest();

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    key,
    Buffer.from(process.env.ACCESS_TOKEN_SECRET).slice(0, 16)
  );
  let decrypted = decipher.update(encryptedToken, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};
/*
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return handleResponse(res, 403, "Access Denied. No token provided.");
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.user_id);
    if (!user || user.role !== "admin") {
      return handleResponse(res, 403, "User not found or not authorized.");
    }

    req.user = {
      id: user._id.toString(),
      user_id: decoded.user_id,
      user_role: decoded.user_role,
      email: decoded.email,
      username: user.username,
      mobile_number: user.mobile_number,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return handleResponse(res, 403, "Invalid token. Please log in again.");
    }
    if (error instanceof jwt.TokenExpiredError) {
      return handleResponse(res, 403, "Token has expired. Please log in again.");
    }
    return handleResponse(res, 500, "Internal server error.");
  }
};
*/

export const verifyToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return handleResponse(res, 403, "Access Denied. No token provided.");
    }

    // Verify JWT token and extract payload
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const { user_id, user_role, email } = decoded;

    let user = null;

    // Fetch user based on role
    if (user_role === "admin") {
      user = await User.findById(user_id);
    } else if (user_role === "agent") {
      user = await Agent.findById(user_id);
    } else if (user_role === "channel_partner") {
      user = await ChannelPartner.findById(user_id);
    } else {
      return handleResponse(res, 403, "Invalid user role.");
    }

    // If user not found, unauthorized
    if (!user) {
      return handleResponse(res, 403, "User not found or not authorized.");
    }

    // Attach user info to req.user for controller use
    req.user = {
      id: user._id.toString(),
      user_id,
      user_role, // role from token: "admin", "agent", or "channel_partner"
      email,
      username: user.username || user.name || null, // fallback to name if username missing
      mobile_number: user.mobile_number || null,
      agent_type: user.agent_type || null, // agent_type is only relevant for agents/channel partners
    };

    next();
  } catch (error) {
    console.error("Token verification error:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      return handleResponse(res, 403, "Invalid token. Please log in again.");
    }
    if (error instanceof jwt.TokenExpiredError) {
      return handleResponse(res, 403, "Token has expired. Please log in again.");
    }
    return handleResponse(res, 500, "Internal server error.");
  }
};
