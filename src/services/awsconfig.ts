import { S3Client,DeleteObjectCommand } from '@aws-sdk/client-s3';
import { String } from 'aws-sdk/clients/appstream';
import multer from 'multer';
import multerS3 from 'multer-s3'

  const s3 = new S3Client({
    region: process.env.region,
    credentials: {
      accessKeyId: process.env.accessKeyId as String,
      secretAccessKey: process.env.secretAccessKey as String,
    },
  });

  export const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.bucket as string,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        // Unique key for the file
        cb(null, `profile-images/${Date.now().toString()}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 1024 * 1024 * 10 }
  });

  // Function to delete an image from S3
  export const deleteImage = async (imageUrl: string) => {
    const params = {
      Bucket: process.env.bucket as string,
      Key: decodeURI(imageUrl.replace(`https://varsitystepsbucket.s3.eu-north-1.amazonaws.com/`, '')),
    };
    try {
      await s3.send(new DeleteObjectCommand(params));
      return 1
    } catch (error) {
      console.error('Error deleting image:', error);
      return error
    }
  };

  /// function to upload post images
  export const uploadFiles = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.bucket as string,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        // Unique key for the file
        cb(null, `tutoring_files/${Date.now().toString()}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 1024 * 1024 * 10 }
  });

  export const uploadProof = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.bucket as string,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        // Unique key for the file
        cb(null, `paymentfiles/${Date.now().toString()}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 1024 * 1024 * 10 }
  });

