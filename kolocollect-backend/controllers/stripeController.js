// backend/controllersController/stripe.js

const stripe = require('../config/stripe');

const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency, userId } = req.body;

    // Create a PaymentIntent with metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { userId }, // Include userId in metadata
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createPaymentIntent };
