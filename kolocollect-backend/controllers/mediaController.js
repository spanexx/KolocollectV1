const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created uploads directory at ${UPLOAD_DIR}`);
}

// Configure multer for file upload to local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.body.userId || 'unknown';
    const fileType = req.body.type || 'misc';
    const uploadPath = path.join(UPLOAD_DIR, fileType, userId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);
    cb(null, `${uuidv4()}${extension}`);
  }
});

// Configure multer for file upload to local storage
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {    // Check file type
    // Define allowed file extensions across all file types
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
    const extension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(extension)) {
      // Accept the file and do detailed type validation after form parsing
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: ' + allowedExtensions.join(', ')));
    }
  }
});

// Create error response helper
const createErrorResponse = (res, status, errorCode, message, resolution) => res.status(status).json({
  error: {
    code: errorCode,
    message,
    timestamp: new Date().toISOString(),
    documentation: "https://api.kolocollect.com/docs/errors/" + errorCode
  }
});

// Upload a file
exports.uploadFile = async (req, res) => {
  try {
    console.log('File upload request received with body:', req.body);
    console.log('Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Log boundary info for multipart/form-data debugging
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      const boundary = req.headers['content-type'].split('boundary=')[1];
      console.log('Form data boundary:', boundary);
    }
    
    // Multer middleware will handle the file upload to local storage
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer upload error:', err);
        return createErrorResponse(res, 400, 'FILE_UPLOAD_ERROR', err.message);
      }
      
      if (!req.file) {
        console.error('No file uploaded in request');
        return createErrorResponse(res, 400, 'NO_FILE_UPLOADED', 'No file was uploaded.');
      }      console.log('File uploaded successfully to local storage:', {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      
      console.log('Request body:', req.body);
      
      // Validate file type more thoroughly now that we have access to req.body
      const { type = 'misc', userId, documentType } = req.body;
      const extension = path.extname(req.file.originalname).toLowerCase();
      
      const allowedFileTypes = {
        'profile': ['.jpg', '.jpeg', '.png', '.gif'],
        'profilePicture': ['.jpg', '.jpeg', '.png', '.gif'],
        'document': ['.jpg', '.jpeg', '.png', '.pdf'],
        'verificationDocument': ['.jpg', '.jpeg', '.png', '.pdf'],
        'misc': ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
      };
        if (!allowedFileTypes[type] || !allowedFileTypes[type].includes(extension)) {
        // Remove the uploaded file since it's not of an allowed type for the specified purpose
        fs.unlinkSync(req.file.path);
        
        console.error(`Invalid file type for ${type}: ${extension}. Allowed: ${allowedFileTypes[type] ? allowedFileTypes[type].join(', ') : 'none'}`);
        return createErrorResponse(
          res, 
          400, 
          'INVALID_FILE_TYPE', 
          `Invalid file type for ${type}. Allowed types: ${allowedFileTypes[type] ? allowedFileTypes[type].join(', ') : 'none'}`
        );
      }
        // Store file reference based on type
      console.log(`Processing file of type: ${type} for user ${userId}`);
      
      if (type === 'profile' || type === 'profilePicture') {
        // Update user's profile picture
        try {
          console.log(`Looking up user with ID: ${userId} to update profile picture`);
          // First try to find by authId
          let user = await User.findOne({ authId: userId });
          
          // If not found by authId, try finding by _id
          if (!user) {
            user = await User.findById(userId);
          }
          
          if (!user) {
            console.error(`User not found with ID: ${userId}`);
            return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
          }
          
          // For local storage, create a URL that can be used to access the file
          const fileUrl = `/api/media/files/${req.file.filename}`;
          const fileId = req.file.filename;
          
          console.log(`Updating profile picture for user ${userId}:`, {
            fileId,
            url: fileUrl
          });
          
          user.profilePicture = {
            fileId,
            url: fileUrl,
            lastUpdated: new Date()
          };
          
          await user.save();
          console.log(`Profile picture updated successfully for user ${userId}`);
        } catch (error) {
          console.error(`Error updating profile picture for user ${userId}:`, error);
          return createErrorResponse(res, 500, 'USER_UPDATE_ERROR', 'Error updating user with profile picture.');
        }
      } else if ((type === 'document' || type === 'verificationDocument') && documentType) {
        // For verification documents, we'll only return the file info and let the frontend handle adding it to the user
        // This prevents duplicate entries when the frontend calls addVerificationDocument
        try {          console.log(`Verification document uploaded for user ${userId} of type: ${documentType}`);
          // First try to find by authId
          let user = await User.findOne({ authId: userId });
          
          // If not found by authId, try finding by _id
          if (!user) {
            user = await User.findById(userId);
          }
          
          if (!user) {
            console.error(`User not found with ID: ${userId}`);
            return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
          }
          
          // Return file info only, don't save to user here
          console.log(`File info prepared for verification document. Frontend will handle adding it to user.`);
        } catch (error) {
          console.error(`Error processing verification document for user ${userId}:`, error);
          return createErrorResponse(res, 500, 'DOCUMENT_PROCESSING_ERROR', 'Error processing verification document.');
        }
      }
      
      // Send back a detailed response with all necessary information
      const fileUrl = `/api/media/files/${req.file.filename}`;
      const response = {
        fileId: req.file.filename,
        url: fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        uploadDate: new Date(),
        size: req.file.size
      };
      
      console.log('Sending response to client:', response);
      res.status(200).json(response);
    });
  } catch (err) {
    console.error('Error in uploadFile:', err);
    createErrorResponse(res, 500, 'FILE_UPLOAD_ERROR', 'An error occurred during file upload.');
  }
};

// Get a URL for a file
exports.getFileUrl = async (req, res) => {
  try {
    const { fileId } = req.params;

    // For local storage, we create a direct URL to the file
    // Adding host info to make it an absolute URL
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;
    const fileUrl = `/api/media/files/${fileId}`;
    
    console.log(`Generating URL for file ${fileId}, base: ${baseUrl}, full URL: ${baseUrl}${fileUrl}`);

    // Return both relative and absolute URLs to give frontend flexibility
    res.status(200).json({ 
      url: fileUrl,
      absoluteUrl: `${baseUrl}${fileUrl}`
    });
  } catch (err) {
    console.error('Error generating URL:', err);
    createErrorResponse(res, 500, 'URL_GENERATION_ERROR', 'An error occurred while generating the file URL.');
  }
};

// Delete a file
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;    // Try to find and delete the file
    const searchAndDelete = (dir, targetFile) => {
      try {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            // Recursively search subdirectories
            const found = searchAndDelete(fullPath, targetFile);
            if (found) return true;
          } else if (entry === targetFile) {
            // Found the file, delete it
            fs.unlinkSync(fullPath);
            console.log(`File deleted: ${fullPath}`);
            return true;
          }
        }
      } catch (err) {
        console.error(`Error searching directory ${dir}:`, err);
      }
      
      return false;
    };
    
    // Search for and delete the file
    const deleted = searchAndDelete(UPLOAD_DIR, fileId);
    
    if (!deleted) {
      console.log(`File not found: ${fileId}`);
    }    // Also remove any references to this file in the user model
    // Get user ID from auth token    const userId = req.user._id;
    
    // Try to determine the file type from the user's data
    // First try to find by authId
    let user = await User.findOne({ authId: userId });
    
    // If not found by authId, try finding by _id
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      console.log(`User not found with ID: ${userId}`);
      return res.status(200).json({ message: 'File reference removed.' });
    }
      // Check if this is a profile picture
    if (user.profilePicture && user.profilePicture.fileId === fileId) {
      // Remove profile picture reference
      // Handle both update by authId and update by _id
      if (user.authId) {
        await User.findOneAndUpdate({ authId: userId }, {
          $unset: { profilePicture: 1 }
        });
      } else {
        await User.findByIdAndUpdate(userId, {
          $unset: { profilePicture: 1 }
        });
      }
      console.log(`Removed profile picture reference for user ${userId}`);
    } 
    // Check if this is a verification document
    else if (user.verificationDocuments && user.verificationDocuments.some(doc => doc.fileId === fileId)) {
      // Remove verification document reference
      // Handle both update by authId and update by _id
      if (user.authId) {
        await User.findOneAndUpdate({ authId: userId }, {
          $pull: { verificationDocuments: { fileId } }
        });
      } else {
        await User.findByIdAndUpdate(userId, {
          $pull: { verificationDocuments: { fileId } }
        });
      }
      console.log(`Removed document reference for user ${userId}`);
    }

    res.status(200).json({ message: 'File deleted successfully.' });
  } catch (err) {
    console.error('Error deleting file:', err);
    createErrorResponse(res, 500, 'FILE_DELETE_ERROR', 'An error occurred while deleting the file.');
  }
};

// List all files for a user
exports.listUserFiles = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;    // Get user
    // First try to find by authId
    let user = await User.findOne({ authId: userId });
    
    // If not found by authId, try finding by _id
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    }

    // Collect files based on type
    let files = [];

    // Profile picture
    if (!type || type === 'profile') {
      if (user.profilePicture) {
        files.push({
          fileId: user.profilePicture.fileId,
          url: user.profilePicture.url,
          fileName: 'Profile Picture',
          fileType: 'image',
          uploadDate: user.profilePicture.lastUpdated
        });
      }
    }

    // Verification documents
    if (!type || type === 'document') {
      if (user.verificationDocuments && user.verificationDocuments.length > 0) {
        const documentFiles = user.verificationDocuments.map(doc => ({
          fileId: doc.fileId,
          url: '',  // URL will be generated when needed for security
          fileName: `${doc.documentType} Document`,
          fileType: 'document',
          uploadDate: doc.uploadDate,
          status: doc.status,
          documentType: doc.documentType
        }));
        files = [...files, ...documentFiles];
      }
    }

    res.status(200).json(files);
  } catch (err) {
    console.error('Error listing files:', err);
    createErrorResponse(res, 500, 'FILES_LIST_ERROR', 'An error occurred while listing files.');
  }
};

// Serve a file
exports.serveFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // First try direct path approach (most efficient)
    // This assumes files are stored with UUID names
    let found = false;
    
    // Try to find the file by searching through directories
    const searchForFile = (dir, targetFile) => {
      try {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            // Recursively search subdirectories
            const foundPath = searchForFile(fullPath, targetFile);
            if (foundPath) return foundPath;
          } else if (entry === targetFile) {
            // Found the file
            return fullPath;
          }
        }
      } catch (err) {
        console.error(`Error searching directory ${dir}:`, err);
      }
      
      return null;
    };
    
    // Search for the file in uploads directory
    const filePath = searchForFile(UPLOAD_DIR, fileId);
    
    if (filePath) {
      console.log(`File found at: ${filePath}`);
      // Set appropriate Content-Type header based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf'
      };
      
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      
      return res.sendFile(filePath);
    } else {
      console.log(`File not found: ${fileId}`);
      return createErrorResponse(res, 404, 'FILE_NOT_FOUND', 'File not found.');
    }
  } catch (err) {
    console.error('Error serving file:', err);
    return createErrorResponse(res, 500, 'FILE_SERVE_ERROR', 'An error occurred while serving the file.');
  }
};

// Get user's profile picture
exports.getProfilePicture = async (req, res) => {
  try {
    const { userId } = req.params;
      // Look up the user to get their profile picture ID
    // First try to find by authId
    let user = await User.findOne({ authId: userId });
    
    // If not found by authId, try finding by _id
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user || !user.profilePicture || !user.profilePicture.fileId) {
      return createErrorResponse(res, 404, 'PROFILE_PICTURE_NOT_FOUND', 'Profile picture not found for this user.');
    }
    
    // Redirect to the file serving endpoint
    res.redirect(`/api/media/files/${user.profilePicture.fileId}`);
  } catch (err) {
    console.error('Error retrieving profile picture:', err);
    createErrorResponse(res, 500, 'PROFILE_PICTURE_ERROR', 'An error occurred while retrieving the profile picture.');
  }
};

// Get user's document by type
exports.getDocumentByType = async (req, res) => {
  try {
    const { userId, documentType } = req.params;
      // Look up the user to get their document
    // First try to find by authId
    let user = await User.findOne({ authId: userId });
    
    // If not found by authId, try finding by _id
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user || !user.verificationDocuments || user.verificationDocuments.length === 0) {
      return createErrorResponse(res, 404, 'DOCUMENT_NOT_FOUND', 'No documents found for this user.');
    }
    
    // Find the requested document by type
    const document = user.verificationDocuments.find(doc => doc.documentType === documentType);
    if (!document || !document.fileId) {
      return createErrorResponse(res, 404, 'DOCUMENT_TYPE_NOT_FOUND', `No ${documentType} document found for this user.`);
    }
    
    // For security, check if the request is authorized
    // Only allow if the requester is the document owner or an admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return createErrorResponse(res, 403, 'DOCUMENT_ACCESS_FORBIDDEN', 'You do not have permission to access this document.');
    }
    
    // Redirect to the file serving endpoint
    res.redirect(`/api/media/files/${document.fileId}`);
  } catch (err) {
    console.error('Error retrieving document:', err);
    createErrorResponse(res, 500, 'DOCUMENT_RETRIEVAL_ERROR', 'An error occurred while retrieving the document.');
  }
};

// Check upload system status
exports.checkStatus = async (req, res) => {
  try {
    // Check if uploads directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      console.log(`Created uploads directory at ${UPLOAD_DIR}`);
    }
    
    // Check directory permissions
    try {
      const testPath = path.join(UPLOAD_DIR, 'test.txt');
      fs.writeFileSync(testPath, 'test');
      fs.unlinkSync(testPath);
      
      res.status(200).json({
        status: 'ok',
        message: 'Upload system is operational',
        uploadDirectory: UPLOAD_DIR,
        permissions: 'read/write',
        fileTypes: {
          profile: ['.jpg', '.jpeg', '.png', '.gif'],
          document: ['.jpg', '.jpeg', '.png', '.pdf'],
          verificationDocument: ['.jpg', '.jpeg', '.png', '.pdf']
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Upload directory exists but has permission issues',
        error: error.message
      });
    }
  } catch (err) {
    console.error('Error checking upload system status:', err);
    createErrorResponse(res, 500, 'UPLOAD_STATUS_ERROR', 'An error occurred while checking upload system status.');
  }
};
