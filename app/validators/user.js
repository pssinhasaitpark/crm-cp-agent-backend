// app/validators/user.js
import Joi from "joi";

export const createAdminValidators = Joi.object({
  username: Joi.string().min(3).required().messages({
  "string.empty": "Username is required",
  "string.min": "Username should have at least 3 characters",
  "any.required": "Username is required",
}),
  email: Joi.string().email().required().messages({
  "string.empty": "Email is required",
  "string.email": "Email must be a valid email address",
  "any.required": "Email is required",
}),
password: Joi.string().min(6).required().messages({
  "string.empty": "Password is required",
  "string.min": "Password should have at least 6 characters",
  "any.required": "Password is required",
}),
confirm_password: Joi.string().valid(Joi.ref("password")).required().messages({
  "any.only": "Password and confirm password must match",
  "string.empty": "Confirm password is required",
  "any.required": "Confirm password is required",
}),
mobile_number: Joi.string()
  .pattern(/^[0-9]{10}$/)
  .required()
  .messages({
    "string.empty": "Mobile number is required",
    "string.pattern.base": "Mobile number must be exactly 10 digits",
    "any.required": "Mobile number is required",
  }),
});

export const loginValidators = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password should have at least 6 characters",
    "any.required": "Password is required",
  }),
});