// app/middlewares/multer.js
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import streamifier from "streamifier";
import sharp from "sharp";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
}).fields([
  { name: "profile_photo", maxCount: 1 },
  { name: "id_proof", maxCount: 1 },
]);

const resizeImageBuffer = async (buffer) => {
  return await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
};

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        format: "webp",
        transformation: [{ quality: "auto" }],
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary Upload Error:", error);
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

const uploadMultipleToCloudinary = async (files) => {
  const uploadPromises = Object.entries(files).map(async ([key, buffer]) => {
    if (!buffer) return [key, null];

    const optimizedBuffer = await resizeImageBuffer(buffer);

    const url = await uploadToCloudinary(optimizedBuffer, `channelPartners/${key}s`);
    return [key, url];
  });

  const results = await Promise.all(uploadPromises);
  return Object.fromEntries(results);
};

export { cloudinary, upload, uploadToCloudinary, uploadMultipleToCloudinary };
