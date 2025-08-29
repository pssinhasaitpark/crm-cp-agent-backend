//app/validators/leads.js
import Joi from "joi";

const baseSchema = {
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone_number: Joi.string().min(10).max(15).required(),
  interested_in: Joi.string().required(),
  source: Joi.string().required(),
  date: Joi.string()
    .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
    .required()
    .messages({
      "string.pattern.base": "Date must be in DD/MM/YYYY format",
    }),
};

const extraFieldsSchema = {
  address: Joi.string().required(),
  property_type: Joi.string().required(),
  requirement_type: Joi.string().required(),
  budget: Joi.string().required(),
  remark: Joi.string().required(),
};

export const getLeadValidationSchema = (userRole) => {
  if (userRole === "agent") {
    return Joi.object({
      ...baseSchema,
      ...extraFieldsSchema,
    });
  } else if (userRole === "channel_partner") {
    return Joi.object({
      ...baseSchema,
      ...extraFieldsSchema,
      assigned_to: Joi.string().required(),
    });
  } else if (userRole === "admin") {
    return Joi.object(baseSchema);
  } else {
    return Joi.object(baseSchema);
  }
};