// backend/routes/checkoutOrdersRoutes.js
const express = require('express');
const router = express.Router();
const CheckoutOrder = require('../models/CheckoutOrder');
const { auth, adminAuth } = require('../middleware/authMiddleware');

// Create new Cash on Delivery order
router.post('/create', auth, async (req, res) => {
  try {
    const {
      customerDetails,
      products,
      pricing,
      paymentMethod = 'cash_on_delivery'
    } = req.body;

    // Validate required fields
    if (!customerDetails || !products || !pricing) {
      return res.status(400).json({ error: 'Missing required order information' });
    }

    // Validate customer details
    const requiredFields = ['name', 'email', 'phone', 'address', 'city', 'zipCode'];
    for (let field of requiredFields) {
      if (!customerDetails[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    // Validate products
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    // Generate a unique order ID (you can customize this format)
    const orderNumber = `COD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create the order
    const newOrder = new CheckoutOrder({
      user: req.user, // This comes from auth middleware
      orderNumber,
      customerDetails,
      products: products.map(product => ({
        productId: product.productId,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: product.quantity,
        ...(product.specialOffer && { specialOffer: product.specialOffer })
      })),
      pricing: {
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        tax: pricing.tax,
        total: pricing.total
      },
      paymentMethod,
      paymentStatus: 'pending', // COD orders start as pending
      orderStatus: 'pending',
      // For COD, we don't need stripeSessionId, so we'll generate a unique identifier
      stripeSessionId: orderNumber // Using order number as unique identifier
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: newOrder._id,
        orderNumber: newOrder.orderNumber,
        total: newOrder.pricing.total,
        paymentMethod: newOrder.paymentMethod,
        orderStatus: newOrder.orderStatus
      }
    });

  } catch (error) {
    console.error('Error creating COD order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get all checkout orders (Admin only)
router.get('/admin/orders', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    // Build query filters
    let query = {};
    
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    if (search) {
      query.$or = [
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.email': { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } },
        { stripeSessionId: { $regex: search, $options: 'i' } },
      ];
    }

    const orders = await CheckoutOrder.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CheckoutOrder.countDocuments(query);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching checkout orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single checkout order (Admin only)
router.get('/admin/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await CheckoutOrder.findById(req.params.id)
      .populate('user', 'name email');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status (Admin only)
router.put('/admin/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { orderStatus, adminNotes, paymentStatus } = req.body;
    
    const updateData = { 
      orderStatus, 
      adminNotes,
      updatedAt: new Date()
    };

    // If payment status is provided, update it (useful for COD when payment is received)
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }

    const order = await CheckoutOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Get orders for a specific user
router.get('/user/orders', auth, async (req, res) => {
  try {
    const userId = req.user;
    const { page = 1, limit = 10 } = req.query;

    const orders = await CheckoutOrder.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CheckoutOrder.countDocuments({ user: userId });

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get dashboard stats (Admin only)
router.get('/admin/dashboard-stats', adminAuth, async (req, res) => {
  try {
    const totalOrders = await CheckoutOrder.countDocuments();
    const pendingOrders = await CheckoutOrder.countDocuments({ orderStatus: 'pending' });
    const processingOrders = await CheckoutOrder.countDocuments({ orderStatus: 'processing' });
    const shippedOrders = await CheckoutOrder.countDocuments({ orderStatus: 'shipped' });
    const deliveredOrders = await CheckoutOrder.countDocuments({ orderStatus: 'delivered' });
    const codOrders = await CheckoutOrder.countDocuments({ paymentMethod: 'cash_on_delivery' });
    
    // Calculate total revenue (including pending COD orders)
    const revenueResult = await CheckoutOrder.aggregate([
      { $match: { orderStatus: { $in: ['delivered', 'processing', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);
    
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Calculate pending COD revenue
    const pendingCODRevenueResult = await CheckoutOrder.aggregate([
      { 
        $match: { 
          paymentMethod: 'cash_on_delivery',
          paymentStatus: 'pending',
          orderStatus: { $ne: 'cancelled' }
        } 
      },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);
    
    const pendingCODRevenue = pendingCODRevenueResult.length > 0 ? pendingCODRevenueResult[0].total : 0;

    res.json({
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      codOrders,
      totalRevenue,
      pendingCODRevenue,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;