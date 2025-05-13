const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Serve files without auth middleware (public access)
router.get('/files/:fileId', mediaController.serveFile);

// Type-specific endpoints for better API structure
router.get('/profile/:userId', mediaController.getProfilePicture);
router.get('/document/:userId/:documentType', mediaController.getDocumentByType);

// Public status endpoint for health checks
router.get('/status', mediaController.checkStatus);

// Apply auth middleware for protected routes
router.use(authMiddleware);

// Upload a file
router.post('/upload', mediaController.uploadFile);

// Get a signed URL for a file
router.get('/url/:fileId', mediaController.getFileUrl);

// Delete a file
router.delete('/files/:fileId', mediaController.deleteFile);

// List all files for a user
router.get('/files/:userId', mediaController.listUserFiles);

module.exports = router;
