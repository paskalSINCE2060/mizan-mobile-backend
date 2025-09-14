const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();

// ✅ Email transporter configuration
let emailTransporter = null;
if (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL_PASSWORD) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.ADMIN_EMAIL_PASSWORD
    }
  });

  // Test email connection
  emailTransporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email configuration error:', error);
      console.error('Check your .env file for ADMIN_EMAIL and ADMIN_EMAIL_PASSWORD');
    } else {
      console.log('✅ Email server is ready to send notifications');
      console.log(`📧 Admin email configured: ${process.env.ADMIN_EMAIL}`);
    }
  });
} else {
  console.warn('⚠️  Email configuration not found. Email notifications disabled.');
  console.warn('Add ADMIN_EMAIL and ADMIN_EMAIL_PASSWORD to your .env file');
}

// Make email transporter available globally
app.locals.emailTransporter = emailTransporter;

// Middleware
app.use(cors());
app.use(express.json());

// Create upload directories if they don't exist
const uploadDirectories = [
  'uploads',
  'uploads/sell-phones'
];

uploadDirectories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Static file serving
app.use('/uploads', express.static('uploads'));

// Booking Schema
const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  device: { type: String, required: true },
  problem: { type: String, required: true },
  preferredDate: { type: Date, required: true },
  preferredTime: { type: String, required: true },
  urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

// Email Templates
const createBookingEmailTemplate = (booking) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; color: #555; }
            .urgency-high { color: #e74c3c; font-weight: bold; }
            .urgency-medium { color: #f39c12; font-weight: bold; }
            .urgency-low { color: #27ae60; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📱 New Repair Booking</h1>
                <p>Mizan Phone Repair Service</p>
            </div>
            <div class="content">
                <p>You have received a new booking request:</p>
                
                <div class="booking-details">
                    <div class="detail-row">
                        <span class="label">Customer Name:</span>
                        <span>${booking.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Email:</span>
                        <span>${booking.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Phone:</span>
                        <span>${booking.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Device:</span>
                        <span>${booking.device}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Problem:</span>
                        <span>${booking.problem}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Preferred Date:</span>
                        <span>${new Date(booking.preferredDate).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Preferred Time:</span>
                        <span>${booking.preferredTime}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Urgency:</span>
                        <span class="urgency-${booking.urgency}">${booking.urgency.toUpperCase()}</span>
                    </div>
                    ${booking.notes ? `
                    <div class="detail-row">
                        <span class="label">Additional Notes:</span>
                        <span>${booking.notes}</span>
                    </div>
                    ` : ''}
                </div>
                
                <p><strong>Please contact the customer to confirm the appointment.</strong></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const createCustomerConfirmationTemplate = (booking) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .highlight { background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📱 Booking Confirmation</h1>
                <p>Mizan Phone Repair Service</p>
            </div>
            <div class="content">
                <p>Dear ${booking.name},</p>
                
                <p>Thank you for choosing Mizan Phone Repair! We have received your booking request.</p>
                
                <div class="highlight">
                    <strong>⏰ What happens next?</strong><br>
                    Our team will contact you within 24 hours to confirm your appointment and provide any additional details.
                </div>
                
                <div class="booking-details">
                    <h3>Your Booking Details:</h3>
                    <p><strong>Device:</strong> ${booking.device}</p>
                    <p><strong>Problem:</strong> ${booking.problem}</p>
                    <p><strong>Preferred Date:</strong> ${new Date(booking.preferredDate).toLocaleDateString()}</p>
                    <p><strong>Preferred Time:</strong> ${booking.preferredTime}</p>
                    <p><strong>Urgency Level:</strong> ${booking.urgency.toUpperCase()}</p>
                </div>
                
                <p>If you have any questions or need to make changes, please contact us:</p>
                <ul>
                    <li>📞 Phone: [Your Phone Number]</li>
                    <li>📧 Email: ${process.env.ADMIN_EMAIL}</li>
                </ul>
                
                <p>We look forward to helping you with your device repair!</p>
                
                <p>Best regards,<br>
                <strong>Mizan Phone Repair Team</strong></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Phone Order Email Templates
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
            .price { color: #27ae60; font-weight: bold; font-size: 1.2em; }
            .priority-express { color: #f39c12; font-weight: bold; }
            .priority-urgent { color: #e74c3c; font-weight: bold; }
            .priority-standard { color: #27ae60; font-weight: bold; }
            .urgent-order { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📱 New Phone Order</h1>
                <p>Mizan Phone Repair Service</p>
            </div>
            <div class="content">
                ${order.priority === 'urgent' ? '<div class="urgent-order"><strong>🚨 URGENT ORDER - SAME DAY DELIVERY REQUESTED!</strong></div>' : ''}
                
                <p>You have received a new phone order:</p>
                
                <div class="order-details">
                    <div class="detail-row">
                        <span class="label">Customer Name:</span>
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
                        <span class="label">Total Price:</span>
                        <span class="price">$${order.totalPrice.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Payment Method:</span>
                        <span>${order.paymentMethod === 'full' ? 'Full Payment' : 'Installment Plan'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Delivery Method:</span>
                        <span>${order.deliveryMethod === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</span>
                    </div>
                    ${order.deliveryMethod === 'pickup' ? `
                    <div class="detail-row">
                        <span class="label">Pickup Date:</span>
                        <span>${order.preferredDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Pickup Time:</span>
                        <span>${order.preferredTime}</span>
                    </div>
                    ` : ''}
                    ${order.deliveryMethod === 'delivery' ? `
                    <div class="detail-row">
                        <span class="label">Delivery Address:</span>
                        <span>${order.address}</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="label">Priority:</span>
                        <span class="priority-${order.priority}">${order.priority.toUpperCase()}</span>
                    </div>
                    ${order.message ? `
                    <div class="detail-row">
                        <span class="label">Special Requests:</span>
                        <span>${order.message}</span>
                    </div>
                    ` : ''}
                    ${order.budget ? `
                    <div class="detail-row">
                        <span class="label">Budget:</span>
                        <span>$${order.budget}</span>
                    </div>
                    ` : ''}
                </div>
                
                <p><strong>Please contact the customer to confirm the order and arrange ${order.deliveryMethod === 'pickup' ? 'pickup' : 'delivery'} details.</strong></p>
                
                ${order.priority === 'urgent' ? '<p style="color: #e74c3c;"><strong>⚠️ This is an urgent order - please process immediately!</strong></p>' : ''}
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
            .highlight { background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0; }
            .price { color: #27ae60; font-weight: bold; font-size: 1.2em; }
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
                
                <p>Thank you for your phone order! We have received your request and will process it shortly.</p>
                
                <div class="highlight">
                    <strong>⏰ What happens next?</strong><br>
                    Our team will contact you within 24 hours to confirm your order and arrange ${order.deliveryMethod === 'pickup' ? 'pickup' : 'delivery'} details.
                </div>
                
                <div class="order-details">
                    <h3>Your Order Details:</h3>
                    <p><strong>Phone:</strong> ${order.model}</p>
                    <p><strong>Color:</strong> ${order.color}</p>
                    <p><strong>Storage:</strong> ${order.storage}</p>
                    <p><strong>Quantity:</strong> ${order.quantity}</p>
                    <p><strong>Total Price:</strong> <span class="price">$${order.totalPrice.toLocaleString()}</span></p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod === 'full' ? 'Full Payment' : 'Installment Plan'}</p>
                    <p><strong>Delivery Method:</strong> ${order.deliveryMethod === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</p>
                    ${order.deliveryMethod === 'pickup' ? `
                    <p><strong>Pickup Date:</strong> ${order.preferredDate}</p>
                    <p><strong>Pickup Time:</strong> ${order.preferredTime}</p>
                    ` : ''}
                    ${order.deliveryMethod === 'delivery' ? `
                    <p><strong>Delivery Address:</strong> ${order.address}</p>
                    ` : ''}
                    <p><strong>Priority:</strong> ${order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}</p>
                </div>
                
                <p>If you have any questions or need to make changes to your order, please contact us:</p>
                <ul>
                    <li>📞 Phone: [Your Phone Number]</li>
                    <li>📧 Email: ${process.env.ADMIN_EMAIL}</li>
                </ul>
                
                <p>We look forward to serving you!</p>
                
                <p>Best regards,<br>
                <strong>Mizan Phone Repair Team</strong></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

// POST /api/bookings - Create new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      model,
      device,
      message,
      problem,
      date,
      preferredDate,
      time,
      preferredTime,
      urgency = 'medium',
      notes
    } = req.body;

    const deviceName = device || model;
    const problemDescription = problem || message;
    const bookingDate = preferredDate || date;
    const bookingTime = preferredTime || time;

    console.log('📋 Booking request received:', {
      name, email, phone, deviceName, problemDescription, bookingDate, bookingTime
    });

    if (!name || !email || !phone || !deviceName || !problemDescription || !bookingDate || !bookingTime) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    const newBooking = new Booking({
      name,
      email,
      phone,
      device: deviceName,
      problem: problemDescription,
      preferredDate: new Date(bookingDate),
      preferredTime: bookingTime,
      urgency,
      notes: notes || message
    });

    const savedBooking = await newBooking.save();

    // Emit real-time event to admin dashboard
    if (app.locals.io) {
      app.locals.io.emit('newBooking', savedBooking);
    }

    if (emailTransporter) {
      try {
        console.log('📧 Sending email notifications...');
        
        // Send notification to admin
        const adminEmailResult = await emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: process.env.ADMIN_EMAIL,
          subject: `🔧 NEW BOOKING ALERT - ${deviceName} Repair (${urgency.toUpperCase()} Priority)`,
          html: createBookingEmailTemplate(savedBooking)
        });
        
        console.log('✅ Admin notification sent:', adminEmailResult.messageId);

        // Send confirmation to customer
        const customerEmailResult = await emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: email,
          subject: '✅ Booking Confirmed - Mizan Phone Repair',
          html: createCustomerConfirmationTemplate(savedBooking)
        });
        
        console.log('✅ Customer confirmation sent:', customerEmailResult.messageId);

      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
      }
    } else {
      console.warn('⚠️ Email transporter not available - no notifications sent');
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully! We will contact you soon.',
      booking: savedBooking
    });

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking. Please try again.'
    });
  }
});

// GET /api/bookings - Get all bookings (for admin)
app.get('/api/bookings', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const filter = status ? { status } : {};
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Booking.countDocuments(filter);

    res.json({
      success: true,
      bookings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: bookings.length,
        totalBookings: total
      }
    });
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
});

// PUT /api/bookings/:id - Update booking status
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      booking
    });
  } catch (error) {
    console.error('❌ Error updating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking'
    });
  }
});

// Import routes
const uploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/payment');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sellPhoneRoutes = require('./routes/sellPhoneRoutes');
const specialOfferRoutes = require('./routes/specialOfferRoutes');
const phoneOrderRoutes = require('./routes/phoneOrderRoutes');
const checkoutOrdersRoutes = require('./routes/checkoutOrdersRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Mount other routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api', uploadRoutes);
app.use('/api/sell-phone', sellPhoneRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/special-offers', specialOfferRoutes);
app.use('/api/admin', phoneOrderRoutes);
app.use('/api/checkout-orders', checkoutOrdersRoutes);
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
app.use('/api', profileRoutes);
app.get('/api/test-profile', (req, res) => {
  res.json({ message: 'Profile routes are working!' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- SOCKET.IO SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Restrict this to your frontend URL in production
    methods: ['GET', 'POST']
  }
});

// Store io instance globally for emitting events
app.locals.io = io;

io.on('connection', (socket) => {
  console.log('🧩 Admin or Client connected via Socket.IO');

  socket.on('disconnect', () => {
    console.log('🔌 A client disconnected');
  });
});

// Start server with Socket.IO
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Sell Phone API available at: http://localhost:${PORT}/api/sell-phone`);
  console.log(`📅 Booking API available at: http://localhost:${PORT}/api/bookings`);
  console.log(`👨‍💼 Admin API available at: http://localhost:${PORT}/api/admin`);
});
