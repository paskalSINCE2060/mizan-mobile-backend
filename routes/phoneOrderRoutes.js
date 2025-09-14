// routes/phoneOrderRoutes.js
const express = require('express');
const router = express.Router();
const PhoneOrder = require('../models/PhoneOrder');

// POST /api/admin/phone-orders - Create new phone order
router.post('/phone-orders', async (req, res) => {
  try {
    console.log('📱 Phone order request received:', req.body);

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
      priority
    } = req.body;

    // Validation
    if (!name || !email || !phone || !model || !color || !storage) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Create new phone order
    const newPhoneOrder = new PhoneOrder({
      name,
      email,
      phone,
      model,
      color,
      storage,
      quantity: quantity || 1,
      paymentMethod: paymentMethod || 'full',
      deliveryMethod: deliveryMethod || 'pickup',
      address: deliveryMethod === 'delivery' ? address : '',
      preferredDate: deliveryMethod === 'pickup' ? preferredDate : '',
      preferredTime: deliveryMethod === 'pickup' ? preferredTime : '',
      message: message || '',
      budget: budget || '',
      priority: priority || 'standard',
      status: 'pending'
    });

    const savedOrder = await newPhoneOrder.save();
    console.log('✅ Phone order saved:', savedOrder._id);

    // Emit real-time event to admin dashboard (if socket.io is available)
    if (req.app.locals.io) {
      req.app.locals.io.emit('newPhoneOrder', savedOrder);
    }

    // Send email notifications (if email transporter is available)
    if (req.app.locals.emailTransporter) {
      try {
        console.log('📧 Sending phone order email notifications...');
        
        // Send notification to admin
        const adminEmailResult = await req.app.locals.emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: process.env.ADMIN_EMAIL,
          subject: `📱 NEW PHONE ORDER - ${model} (${priority.toUpperCase()} Priority)`,
          html: createPhoneOrderEmailTemplate(savedOrder)
        });
        
        console.log('✅ Admin phone order notification sent:', adminEmailResult.messageId);

        // Send confirmation to customer
        const customerEmailResult = await req.app.locals.emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: email,
          subject: '✅ Phone Order Confirmed - Mizan Phone Repair',
          html: createPhoneOrderCustomerConfirmationTemplate(savedOrder)
        });
        
        console.log('✅ Customer phone order confirmation sent:', customerEmailResult.messageId);

      } catch (emailError) {
        console.error('❌ Phone order email sending failed:', emailError);
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
      error: error.message
    });
  }
});

// GET /api/admin/phone-orders - Get all phone orders (for admin)
router.get('/phone-orders', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const filter = status ? { status } : {};
    const skip = (page - 1) * limit;

    const orders = await PhoneOrder.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await PhoneOrder.countDocuments(filter);

    res.json({
      success: true,
      orders,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: orders.length,
        totalOrders: total
      }
    });
  } catch (error) {
    console.error('❌ Error fetching phone orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch phone orders'
    });
  }
});

// PUT /api/admin/phone-orders/:id - Update phone order status
router.put('/phone-orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const order = await PhoneOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Phone order not found'
      });
    }

    res.json({
      success: true,
      message: 'Phone order status updated successfully',
      order
    });
  } catch (error) {
    console.error('❌ Error updating phone order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update phone order'
    });
  }
});

// Email template functions (you can move these to a separate file if needed)
const createPhoneOrderEmailTemplate = (order) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .order-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; color: #555; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📱 New Phone Order</h1>
                <p>Mizan Phone Repair Service</p>
            </div>
            <div class="content">
                <p>You have received a new phone order:</p>
                <div class="order-details">
                    <div class="detail-row">
                        <span class="label">Customer:</span>
                        <span>${order.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Email:</span>
                        <span>${order.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Phone:</span>
                        <span>${order.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Model:</span>
                        <span>${order.model}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Color:</span>
                        <span>${order.color}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Storage:</span>
                        <span>${order.storage}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Quantity:</span>
                        <span>${order.quantity}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Payment Method:</span>
                        <span>${order.paymentMethod === 'full' ? 'Full Payment' : 'Installment Plan'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Delivery Method:</span>
                        <span>${order.deliveryMethod === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</span>
                    </div>
                    ${order.deliveryMethod === 'delivery' ? `
                    <div class="detail-row">
                        <span class="label">Delivery Address:</span>
                        <span>${order.address}</span>
                    </div>
                    ` : ''}
                    ${order.deliveryMethod === 'pickup' ? `
                    <div class="detail-row">
                        <span class="label">Pickup Date:</span>
                        <span>${order.preferredDate} at ${order.preferredTime}</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="label">Priority:</span>
                        <span>${order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}</span>
                    </div>
                    ${order.budget ? `
                    <div class="detail-row">
                        <span class="label">Budget:</span>
                        <span>${order.budget}</span>
                    </div>
                    ` : ''}
                    ${order.message ? `
                    <div class="detail-row">
                        <span class="label">Message:</span>
                        <span>${order.message}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

const createPhoneOrderCustomerConfirmationTemplate = (order) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .order-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; color: #555; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📱 Order Confirmation</h1>
                <p>Mizan Phone Repair Service</p>
            </div>
            <div class="content">
                <p>Dear ${order.name},</p>
                <p>Thank you for your phone order! We have received your request and will contact you within 24 hours to discuss pricing and finalize the details.</p>
                
                <div class="order-details">
                    <h3>📱 Your Order Details:</h3>
                    <div class="detail-row">
                        <span class="label">Phone Model:</span>
                        <span>${order.model}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Color:</span>
                        <span>${order.color}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Storage:</span>
                        <span>${order.storage}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Quantity:</span>
                        <span>${order.quantity}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Delivery Method:</span>
                        <span>${order.deliveryMethod === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</span>
                    </div>
                    ${order.budget ? `
                    <div class="detail-row">
                        <span class="label">Your Budget:</span>
                        <span>${order.budget}</span>
                    </div>
                    ` : ''}
                </div>
                
                <p><strong>What's Next?</strong></p>
                <p>Our team will review your order and contact you within 24 hours to:</p>
                <ul>
                    <li>Provide accurate pricing for your selected phone model</li>
                    <li>Confirm availability and delivery/pickup details</li>
                    <li>Process your order and arrange payment</li>
                </ul>
                
                <p>If you have any immediate questions, please don't hesitate to contact us.</p>
                
                <p>Thank you for choosing Mizan Phone Repair!</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = router;