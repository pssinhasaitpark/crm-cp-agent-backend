//app/validators/projects.js
import Joi from "joi";

const projectValidation = Joi.object({
  project_title: Joi.string().required(),
  description: Joi.string().required(),
  location: Joi.string().required(),
  price_range: Joi.string().required(), // e.g. "₹40 L - ₹1.2 Cr"
});

export default projectValidation;
