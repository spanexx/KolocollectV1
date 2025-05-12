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
router.get('/:userId/upcoming-payouts', userController.getUpcomingPayouts);
router.post('/:userId/clean-up-logs', userController.cleanUpLogs);
router.post('/logout', userController.logoutUser); // Added logout route
router.post('/update-password', userController.updatePassword);
router.get('/:userId/communities', userController.getUserCommunities);
router.get('/:userId/notifications', userController.getUserNotifications);
router.post('/:userId/notifications/:notificationId/read', userController.markNotificationAsRead);
router.post('/:userId/notifications/read-all', userController.markAllNotificationsAsRead);

module.exports = router;
