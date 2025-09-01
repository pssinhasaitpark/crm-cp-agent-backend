//app/controllers/projects.js
import Project from "../models/projects.js";
import projectValidation from "../validators/projects.js";
import { uploadFilesToCloudinary } from "../middlewares/multer.js";
import { handleResponse } from "../utils/helper.js";
/*
const createProjects = async (req, res) => {
  try {
    // ✅ Restrict to admins only (if needed)
    if (!req.user || req.user.user_role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    // ✅ Validate input
    const { error } = projectValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // ✅ Check for required files
    if (!req.files.images || !req.files.brouchers) {
      return res.status(400).json({ message: "Images and brochure are required" });
    }

    // ✅ Upload images & brochure to Cloudinary
    const uploaded = await uploadFilesToCloudinary(req.files);

    // ✅ Create project in DB
    const newProject = new Project({
      project_title: req.body.project_title,
      description: req.body.description,
      location: req.body.location,
      price_range: req.body.price_range,
      images: uploaded.images,
      brouchers: uploaded.brouchers[0], // Single brochure URL
      created_by: req.user.id,           // user._id from token
      created_by_role: req.user.user_role,
    });

    await newProject.save();

    // ✅ Convert to plain object for response
    const responseProject = newProject.toObject();

    // (Optional) Just to be safe — explicitly assign what you want to see
    responseProject.created_by = req.user.id;
    responseProject.created_by_role = req.user.user_role;

    // ✅ Respond
    res.status(201).json({
      message: "✅ Project created",
      project: responseProject,
    });
  } catch (err) {
    console.error("❌ Error creating project:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
*/

const createProjects = async (req, res) => {
  try {
    // ✅ Optional: restrict to admins
    if (!req.user || req.user.user_role !== "admin") {
      return handleResponse(res, 403, "Forbidden: Admins only");
    }

    // ✅ Validate body
    const { error } = projectValidation.validate(req.body);
    if (error) {
      return handleResponse(res, 400, error.details[0].message);
    }

    // ✅ Check files
    if (!req.files.images || !req.files.brouchers) {
      return handleResponse(res, 400, "Images and brochure are required");
    }

    // ✅ Upload to Cloudinary
    const uploaded = await uploadFilesToCloudinary(req.files);

    // ✅ Save project to DB
    const newProject = new Project({
      project_title: req.body.project_title,
      description: req.body.description,
      location: req.body.location,
      price_range: req.body.price_range,
      images: uploaded.images,
      brouchers: uploaded.brouchers[0],
      created_by: req.user.id,
      created_by_role: req.user.user_role,
    });

    await newProject.save();

    // ✅ Build custom response object
    const responseProject = newProject.toObject();
    responseProject.created_by = req.user.id;
    responseProject.created_by_role = req.user.user_role;

    // ✅ Return standardized response
    return handleResponse(res, 201, "Project created by Successfully", responseProject );

  } catch (err) {
    console.error("❌ Error creating project:", err);
    return handleResponse(res, 500, "Server Error", { error: err.message });
  }
};

export const projects = {
    createProjects
};