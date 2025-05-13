const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const walletController = require('../controllers/walletController');

// Public Routes (do not require authentication)
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/request-reset-password', userController.requestPasswordReset);
router.post('/reset-password', userController.resetPassword);

// Apply auth middleware for all routes defined after this point
const authMiddleware = require('../middlewares/authMiddleware');
router.use(authMiddleware);

// Protected Routes
router.get('/search', userController.searchUsers); // Add user search endpoint
router.get('/:userId/profile', userController.getUserProfile);
router.put('/:userId/profile', userController.updateUserProfile); // Added profile update endpoint
router.get('/:userId/upcoming-payouts', userController.getUpcomingPayouts);
router.post('/:userId/clean-up-logs', userController.cleanUpLogs);
router.post('/logout', userController.logoutUser); // Added logout route
router.put('/:userId/password', userController.updatePassword); // Changed to match frontend path
router.get('/:userId/communities', userController.getUserCommunities);
router.get('/:userId/notifications', userController.getUserNotifications);
router.get('/:userId/activity-log', userController.getUserActivityLog); // Activity log endpoint
router.post('/:userId/notifications/:notificationId/read', userController.markNotificationAsRead);
router.post('/:userId/notifications/read-all', userController.markAllNotificationsAsRead);

// Profile picture and document management routes
router.put('/:userId/profile-picture', userController.updateProfilePicture);
router.get('/:userId/verification-documents', userController.getVerificationDocuments);
router.post('/:userId/verification-documents', userController.addVerificationDocument);
router.delete('/:userId/verification-documents/:documentId', userController.deleteVerificationDocument);

// Admin routes for document verification
router.post('/:userId/verification-documents/:documentId/verify', userController.verifyDocument);
router.post('/:userId/verification-documents/:documentId/reject', userController.rejectDocument);

module.exports = router;
