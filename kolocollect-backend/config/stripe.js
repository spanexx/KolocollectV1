// backend/config/stripe.js
const Stripe = require('stripe');

// Initialize Stripe with your secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 




module.exports = stripe;
