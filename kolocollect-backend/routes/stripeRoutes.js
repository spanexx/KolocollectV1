const express = require('express');
const { createPaymentIntent } = require('../controllers/stripeController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(authMiddleware);

// Route to create a PaymentIntent
router.post('/payment-intent', createPaymentIntent);

module.exports = router;
