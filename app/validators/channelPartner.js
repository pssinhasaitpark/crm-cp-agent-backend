//app/validators/channelPartner.js
import Joi from "joi";

export const createChannelPartnerValidator = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters long",
  }),
  confirm_password: Joi.any().equal(Joi.ref("password")).required().messages({
    "any.only": "Password and Confirm Password do not match",
    "any.required": "Confirm Password is required",
  }),
  mobile_number: Joi.string().length(10).pattern(/^[0-9]+$/).required().messages({
    "string.empty": "Mobile number is required",
    "string.length": "Mobile number must be exactly 10 digits",
    "string.pattern.base": "Mobile number must contain only digits",
  }),

  state: Joi.string().required().messages({
    "string.empty": "State is required",
  }),
  firm_name: Joi.string().required().messages({
    "string.empty": "Firm name is required",
  }),
  reraId: Joi.string().optional(),
  agent_type: Joi.string().valid("agent", "channel_partner").required().messages({
    "any.only": "Agent type must be either agent or channel_partner",
  }),
  year_of_experience: Joi.number().min(0).required().messages({
    "number.base": "Year of experience must be a number",
    "any.required": "Year of experience is required",
  }),

  profile_photo: Joi.any().required().messages({
    "any.required": "Profile photo is required",
  }),
  id_proof: Joi.any().required().messages({
    "any.required": "ID proof is required",
  }),

  referral_code: Joi.string().optional(),
});