// app/validators/customer.js
import Joi from "joi";

const baseSchema = {
  name: Joi.string().required(),
  phone_number: Joi.string().min(10).max(15).required(),
  email: Joi.string().email().required(),
  source: Joi.string().required(),
};

const extraFieldsSchema = {
  address: Joi.string(),
  city: Joi.string(),
  property_type: Joi.string(),
  requirement_type: Joi.string(),
  notes: Joi.string(),
};

export const getCustomerValidationSchema = (userRole) => {
  if (userRole === "agent" || userRole === "channel_partner" || userRole === "admin") {
    return Joi.object({
      ...baseSchema,
      ...extraFieldsSchema,
      assigned_to: Joi.string().optional(),
    });
  } else {
    return Joi.object(baseSchema);
  }
};
