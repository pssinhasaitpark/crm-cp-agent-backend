//app/middlewares/multer.js
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "@fluidjs/multer-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "uploads"; 
    if (file.fieldname === "profile_photo") folder = "channel_partners/profile";
    if (file.fieldname === "id_proof") folder = "channel_partners/id_proofs";

    return {
      folder,
      format: "webp",
      transformation: [{ quality: "auto" }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type"), false);
};

const upload = multer({ storage, fileFilter }).fields([
  { name: "profile_photo", maxCount: 1 },
  { name: "id_proof", maxCount: 1 },
]);

export { cloudinary, upload };