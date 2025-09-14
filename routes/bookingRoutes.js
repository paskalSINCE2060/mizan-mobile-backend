const express = require('express');
const nodemailer = require('nodemailer');
const Booking = require('../models/Booking'); // Adjust path as needed
const router = express.Router();

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_EMAIL_PASSWORD
  }
});

// Test email configuration on startup
emailTransporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// POST route for creating a new booking
router.post('/bookings', async (req, res) => {
  try {
    const { name, phone, email, device, issue, date } = req.body;

    // Validate required fields
    if (!name || !phone || !device || !issue || !date) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Validate date is not in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Booking date cannot be in the past'
      });
    }

    // Create new booking
    const newBooking = new Booking({
      name,
      phone,
      email: email || '', // Email is optional
      device,
      issue,
      date: selectedDate,
      status: 'pending'
    });

    // Save booking to database
    const savedBooking = await newBooking.save();

    // Format date for email
    const formattedDate = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Email content for admin notification
    const adminEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          🔧 New Phone Repair Booking
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Customer Details</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email || 'Not provided'}</p>
        </div>

        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">Repair Details</h3>
          <p><strong>Device:</strong> ${device}</p>
          <p><strong>Issue:</strong> ${issue}</p>
          <p><strong>Preferred Date:</strong> ${formattedDate}</p>
        </div>

        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">Booking Information</h3>
          <p><strong>Booking ID:</strong> ${savedBooking._id}</p>
          <p><strong>Status:</strong> <span style="background-color: #ffc107; color: #856404; padding: 2px 8px; border-radius: 4px;">Pending</span></p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="background-color: #007bff; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="margin: 0;"><strong>Next Steps:</strong></p>
          <p style="margin: 5px 0;">1. Contact customer to confirm appointment</p>
          <p style="margin: 5px 0;">2. Provide repair estimate</p>
          <p style="margin: 5px 0;">3. Schedule the repair service</p>
        </div>

        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
        <p style="color: #6c757d; font-size: 12px; text-align: center;">
          This notification was sent from your Mizan Phone Repair booking system.
        </p>
      </div>
    `;

    // Email content for customer confirmation
    const customerEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #007bff; text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          📱 Booking Confirmation - Mizan Phone Repair
        </h2>
        
        <p style="font-size: 16px; color: #333;">Dear <strong>${name}</strong>,</p>
        
        <p style="color: #333;">Thank you for choosing Mizan Phone Repair! We have received your booking request and our team will contact you soon to confirm your appointment.</p>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
          <h3 style="color: #007bff; margin-top: 0;">Your Booking Details</h3>
          <p><strong>Device:</strong> ${device}</p>
          <p><strong>Issue:</strong> ${issue}</p>
          <p><strong>Preferred Date:</strong> ${formattedDate}</p>
          <p><strong>Booking ID:</strong> ${savedBooking._id}</p>
        </div>

        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #155724; margin-top: 0;">What Happens Next?</h3>
          <ol style="color: #155724; padding-left: 20px;">
            <li>Our team will review your booking request</li>
            <li>We'll contact you within 24 hours to confirm the appointment</li>
            <li>We'll provide an estimated cost for the repair</li>
            <li>Bring your device at the scheduled time</li>
          </ol>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #856404; margin: 0;"><strong>Need to make changes?</strong></p>
          <p style="color: #856404; margin: 5px 0;">Please contact us at ${phone} or reply to this email.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #333; font-size: 16px;">Thank you for trusting us with your device repair!</p>
          <p style="color: #007bff; font-weight: bold;">- Mizan Phone Repair Team</p>
        </div>

        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
        <p style="color: #6c757d; font-size: 12px; text-align: center;">
          Mizan Phone Repair | Professional Phone Repair Services<br>
          This is an automated confirmation email.
        </p>
      </div>
    `;

    // Send admin notification email
    try {
      await emailTransporter.sendMail({
        from: process.env.ADMIN_EMAIL,
        to: process.env.ADMIN_NOTIFICATION_EMAIL,
        subject: `🔧 New Repair Booking - ${device} (${name})`,
        html: adminEmailContent
      });
      console.log('✅ Admin notification email sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send admin notification email:', emailError);
    }

    // Send customer confirmation email (if email provided)
    if (email && email.trim() !== '') {
      try {
        await emailTransporter.sendMail({
          from: process.env.ADMIN_EMAIL,
          to: email,
          subject: `📱 Booking Confirmation - Your ${device} Repair Request`,
          html: customerEmailContent
        });
        console.log('✅ Customer confirmation email sent successfully');
      } catch (emailError) {
        console.error('❌ Failed to send customer confirmation email:', emailError);
      }
    }

    // Send success response
    res.status(201).json({
      success: true,
      message: 'Your booking has been submitted successfully! We\'ll contact you soon to confirm your appointment.',
      booking: {
        id: savedBooking._id,
        name: savedBooking.name,
        device: savedBooking.device,
        date: formattedDate,
        status: savedBooking.status
      }
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    
    if (error.name === 'ValidationError') {
      // Handle mongoose validation errors
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// GET route to fetch all bookings (for admin)
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(50); // Limit to latest 50 bookings

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
});

// GET route to fetch booking by ID
router.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking'
    });
  }
});

// PUT route to update booking status
router.put('/bookings/:id', async (req, res) => {
  try {
    const { status, adminNotes, estimatedCost } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        adminNotes, 
        estimatedCost,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking updated successfully',
      booking
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking'
    });
  }
});

module.exports = router;