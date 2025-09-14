const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const PhoneOrder = require('../models/PhoneOrder');

// 📊 Admin Dashboard Stats
router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments();

    const salesOverTime = [
      { month: 'Jan', sales: 200 },
      { month: 'Feb', sales: 400 },
      { month: 'Mar', sales: 300 },
    ];

    const products = await Product.find();
    const categoryDistribution = {};
    products.forEach((product) => {
      categoryDistribution[product.category] =
        (categoryDistribution[product.category] || 0) + 1;
    });

    res.json({
      totalProducts,
      totalOrders,
      totalUsers,
      salesOverTime,
      categoryDistribution,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/admin/phone-orders - Create new phone order
router.post('/api/admin/phone-orders', async (req, res) => {
  try {
    console.log('📦 Incoming phone order data:', req.body);

    const {
      name,
      email,
      phone,
      model,
      color,
      storage,
      quantity,
      paymentMethod,
      deliveryMethod,
      address,
      preferredDate,
      preferredTime,
      message,
      budget,
      priority,
      totalPrice
    } = req.body;

    // Validation
    if (!name || !email || !phone || !model || !color || !storage) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Create new phone order using your existing PhoneOrder model
    const PhoneOrder = require('./models/PhoneOrder'); // Adjust path as needed
    
    const newOrder = new PhoneOrder({
      name,
      email,
      phone,
      model,
      color,
      storage,
      quantity: parseInt(quantity),
      paymentMethod,
      deliveryMethod,
      address: deliveryMethod === 'delivery' ? address : '',
      preferredDate: deliveryMethod === 'pickup' ? preferredDate : '',
      preferredTime: deliveryMethod === 'pickup' ? preferredTime : '',
      message,
      budget,
      priority,
      totalPrice
    });

    const savedOrder = await newOrder.save();
    console.log('✅ Phone order created successfully:', savedOrder._id);

    // Emit real-time event to admin dashboard
    if (app.locals.io) {
      app.locals.io.emit('newPhoneOrder', savedOrder);
      console.log('📡 Real-time notification sent to admin dashboard');
    }

    // Send email notifications
    if (emailTransporter) {
      try {
        console.log('📧 Sending phone order email notifications...');
        
        // Send notification to admin
        const adminEmailResult = await emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: process.env.ADMIN_EMAIL,
          subject: `📱 NEW PHONE ORDER - ${model} (${priority.toUpperCase()} Priority) - $${totalPrice.toLocaleString()}`,
          html: createPhoneOrderEmailTemplate(savedOrder)
        });
        
        console.log('✅ Admin phone order notification sent:', adminEmailResult.messageId);

        // Send confirmation to customer
        const customerEmailResult = await emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: email,
          subject: '📱 Phone Order Confirmed - Mizan Phone Repair',
          html: createPhoneOrderCustomerConfirmationTemplate(savedOrder)
        });
        
        console.log('✅ Customer phone order confirmation sent:', customerEmailResult.messageId);

      } catch (emailError) {
        console.error('❌ Phone order email sending failed:', emailError);
        // Don't fail the entire request if email fails
      }
    } else {
      console.warn('⚠️ Email transporter not available - no phone order notifications sent');
    }

    res.status(201).json({
      success: true,
      message: 'Phone order created successfully! We will contact you soon.',
      order: savedOrder
    });

  } catch (error) {
    console.error('❌ Phone order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create phone order. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔔 Get Notification Count for Phone Orders
router.get('/phone-orders/notifications/count', adminAuth, async (req, res) => {
  try {
    const pendingOrders = await PhoneOrder.countDocuments({ status: 'pending' });
    const totalOrders = await PhoneOrder.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        pendingOrders,
        totalOrders,
      },
    });
  } catch (err) {
    console.error('Error getting phone order counts:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch order count' 
    });
  }
});

// 📱 Get all phone orders
router.get('/phone-orders', adminAuth, async (req, res) => {
  try {
    const orders = await PhoneOrder.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: orders,
      message: 'Phone orders retrieved successfully'
    });
  } catch (err) {
    console.error('❌ Error fetching phone orders:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch orders', 
      error: err.message 
    });
  }
});

module.exports = router;