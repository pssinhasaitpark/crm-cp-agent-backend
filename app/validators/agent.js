// app/validators/agent.js
import Joi from "joi";
import dayjs from "dayjs";

export const createAgentValidator = Joi.object({
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
  year_of_experience: Joi.number().min(0).required().messages({
    "number.base": "Year of experience must be a number",
    "any.required": "Year of experience is required",
  }),

  agent_type: Joi.string()
    .valid("in_house", "external")
    .required()
    .messages({
      "string.empty": "Agent type is required",
      "any.only": "Agent type must be either 'in_house' or 'external'",
    }),

  referral_code: Joi.string().optional(),
});

export const followUpSchema = Joi.object({
  task: Joi.string().optional(),
  notes: Joi.string().optional(),
  follow_up_date: Joi.string()
    .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
    .message("follow_up_date must be in DD/MM/YYYY format")
    .optional()
    .custom((value, helpers) => {
      const date = dayjs(value, "DD/MM/YYYY");

      if (!date.isValid()) {
        return helpers.message("Invalid follow_up_date format");
      }

      const today = dayjs().startOf("day");

      if (date.isBefore(today)) {
        return helpers.message("follow_up_date cannot be in the past");
      }

      return value;
    }),
});