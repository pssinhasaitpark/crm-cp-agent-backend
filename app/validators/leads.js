//app/validators/leads.js
import Joi from "joi";

export const leadValidationSchema = Joi.object({
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
});