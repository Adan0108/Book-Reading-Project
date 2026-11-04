import multer from 'multer';

// File Filter: Check if the file is a valid image
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define the formats you want to allow
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    // Reject the file with a custom error message
    cb(new Error('INVALID_FILE_TYPE')); 
  }
}

// Memory Storage Configuration
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit (adjust as needed)
  },
  fileFilter: imageFileFilter,
})

// Disk Storage: Saves the file to your local server (useful for local backups)
export const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, './src/uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()} - ${file.originalname}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
})