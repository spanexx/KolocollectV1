//backend/middlewares/webhookMiddleware.js
const bodyParser = require('body-parser');
const User = require('../models/User');

const stripeWebhook = async (req, res) => {
  const rawBody = req.rawBody; // Raw request body
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata.userId;
      const amountReceived = paymentIntent.amount_received / 100; // Convert to dollars

      // Update wallet balance
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      wallet.balance += amountReceived;
      wallet.transactions.push({
        amount: amountReceived,
        type: 'deposit',
        description: 'Stripe Payment',
      });

      await wallet.save();
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

module.exports = stripeWebhook;
