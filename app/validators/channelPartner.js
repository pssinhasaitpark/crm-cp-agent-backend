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
  confirm_password: Joi.any()
  .equal(Joi.ref("password"))
  .required()
  .messages({
    "any.only": "Password and Confirm Password do not match",
    "any.required": "Confirm Password is required",
  }),
  mobile_number: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.empty": "Mobile number is required",
      "string.length": "Mobile number must be exactly 10 digits",
      "string.pattern.base": "Mobile number must contain only digits",
    }),
});

// export const loginValidator = Joi.object({
//   // Secret Key validation
//   secret_key: Joi.string()
//     .valid(process.env.HARD_CODED_SECRET_KEY)
//     .required()
//     .messages({
//       "string.empty": "Secret key is missing",
//       "any.only": "Secret key is invalid",
//     }),

//   // Option 1: Email and Password login
//   email: Joi.string().email().when('mobile_number', {
//     is: Joi.exist(),
//     then: Joi.forbidden(),
//     otherwise: Joi.required().messages({
//       "string.empty": "Email is required",
//       "string.email": "Invalid email format",
//     }),
//   }),

//   password: Joi.string().min(6).when('email', {
//     is: Joi.exist(),
//     then: Joi.required().messages({
//       "string.empty": "Password is required",
//       "string.min": "Password must be at least 6 characters long",
//     }),
//     otherwise: Joi.forbidden(),
//   }),

//   // Option 2: Mobile number and OTP login
//   mobile_number: Joi.string().length(10).pattern(/^[0-9]+$/).when('email', {
//     is: Joi.exist(),
//     then: Joi.forbidden(),
//     otherwise: Joi.required().messages({
//       "string.empty": "Mobile number is required",
//       "string.length": "Mobile number must be exactly 10 digits",
//       "string.pattern.base": "Mobile number must contain only digits",
//     }),
//   }),

//   otp: Joi.string().length(6).pattern(/^[0-9]+$/).when('mobile_number', {
//     is: Joi.exist(),
//     then: Joi.required().messages({
//       "string.empty": "OTP is required",
//       "string.length": "OTP must be exactly 6 digits",
//       "string.pattern.base": "OTP must contain only digits",
//     }),
//     otherwise: Joi.forbidden(),
//   }),
// });

