// backend/routes/payment.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const CheckoutOrder = require('../models/CheckoutOrder');
const User = require('../models/User'); // If you're using user authentication
const bodyParser = require('body-parser');

// Log Stripe key for debugging (optional)
console.log('Stripe key in payment.js:', process.env.STRIPE_SECRET_KEY);

// Middleware for webhook raw body parsing (used only on /webhook route)
router.use('/webhook', express.raw({ type: 'application/json' }));

// Route: Create Stripe Checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { cartItems } = req.body;

    const line_items = cartItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: [item.image],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Route: Retrieve Stripe session details
router.get('/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  try {
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer_details'],
    });

    res.json(session);
  } catch (error) {
    console.error('Failed to retrieve session:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// Route: Create Order after successful payment
router.post('/create-order', async (req, res) => {
  try {
    const { sessionId, customerDetails } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer_details'],
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // This assumes user info is attached via middleware (e.g. JWT)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const products = session.line_items.data.map(item => ({
      productId: item.price.product,
      name: item.description,
      image: item.price.product_data?.images?.[0] || '',
      price: item.price.unit_amount / 100,
      quantity: item.quantity,
    }));

    const subtotal = session.amount_subtotal / 100;
    const total = session.amount_total / 100;
    const shipping = (session.shipping_cost?.amount_total || 0) / 100;
    const tax = ((session.amount_total - session.amount_subtotal) / 100) - shipping;

    const checkoutOrder = new CheckoutOrder({
      user: userId,
      stripeSessionId: sessionId,
      customerDetails,
      products,
      pricing: {
        subtotal,
        shipping,
        tax,
        total,
      },
      paymentStatus: 'paid',
      orderStatus: 'pending',
    });

    await checkoutOrder.save();

    res.json({
      success: true,
      orderId: checkoutOrder._id,
      message: 'Order created successfully',
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Stripe Webhook Endpoint
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle specific Stripe events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      try {
        await CheckoutOrder.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            paymentStatus: 'paid',
            orderStatus: 'processing',
          }
        );
      } catch (error) {
        console.error('Error updating order:', error);
      }
      break;

    case 'payment_intent.payment_failed':
      // Optional: handle failed payment
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
