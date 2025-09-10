//app/validators/leads.js
import Joi from "joi";
import dayjs from "dayjs";

const baseSchema = {
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone_number: Joi.string().min(10).max(15).required(),
  // interested_in: Joi.string().required(),
  interested_in: Joi.alternatives().try(
    Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    Joi.string().min(3)                      
  ).required(),
  source: Joi.string().required(),
};

const extraFieldsSchema = {
  address: Joi.string().required(),
  property_type: Joi.string().required(),
  requirement_type: Joi.string().required(),
  budget: Joi.string().required(),
  remark: Joi.string().required(),
  location: Joi.string().required(),
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

export const updateLeadSchema = Joi.object({
  status: Joi.string().optional(),
  assigned_to: Joi.string().optional(),
}).unknown(false); 


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

