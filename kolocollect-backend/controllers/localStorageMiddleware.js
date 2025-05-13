const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create subdirectories based on user ID and file type
    const userId = req.body.userId || 'unknown';
    const fileType = req.body.type || 'misc';
    const directory = path.join(uploadDir, fileType, userId);
    
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    cb(null, directory);
  },
  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;
    cb(null, fileName);
  }
});

// File filter - check if file type is allowed
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = {
    'profile': ['.jpg', '.jpeg', '.png', '.gif'],
    'document': ['.jpg', '.jpeg', '.png', '.pdf'],
    'profilePicture': ['.jpg', '.jpeg', '.png', '.gif'],
    'verificationDocument': ['.jpg', '.jpeg', '.png', '.pdf']
  };

  const fileType = req.body.type || 'misc';
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedFileTypes[fileType] && allowedFileTypes[fileType].includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: ' + 
      (allowedFileTypes[fileType] ? allowedFileTypes[fileType].join(', ') : 'none')));
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// This function adds the file location and key similar to S3 uploads
const addLocalFileInfo = (req, res, next) => {
  if (req.file) {
    // Add S3-like properties to the file object
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path);
    const normalizedPath = relativePath.replace(/\\/g, '/'); // Convert Windows paths to URL format
    
    req.file.location = `${baseUrl}/${normalizedPath}`;
    req.file.key = normalizedPath;
  }
  next();
};

module.exports = {
  upload,
  addLocalFileInfo
};
