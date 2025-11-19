
import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import streamifier from 'streamifier';
import { protect } from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
});

// The upload handler function
const handleUpload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  // Define the upload function as a promise
  const streamUpload = (fileBuffer) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          folder: 'flowtrack',
          resource_type: 'auto' // Automatically detect format (image, raw, video, etc.)
        },
        (error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        }
      );
      streamifier.createReadStream(fileBuffer).pipe(stream);
    });
  };

  // Call the upload function
  streamUpload(req.file.buffer)
    .then(result => {
      res.status(200).json({ url: result.secure_url });
    })
    .catch(error => {
      console.error('Cloudinary Upload Error:', error);
      res.status(500).json({ message: 'Error uploading file to Cloudinary.' });
    });
};

router.post('/', protect, upload.single('file'), handleUpload);

export default router;