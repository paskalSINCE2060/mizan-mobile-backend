// routes/sellPhoneRoutes.js
const express = require('express');
const router = express.Router();
const SellPhoneRequest = require('../models/SellPhoneRequest');
const { auth, adminAuth } = require('../middleware/authMiddleware'); // Assuming you have auth middleware
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/sell-phones/');
  },
  filename: function (req, file, cb) {
    cb(null, 'phone-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images Only!');
    }
  }
});

// @route   POST /api/sell-phone/request
// @desc    Submit a sell phone request
// @access  Public
router.post('/request', upload.single('phoneImage'), async (req, res) => {
  try {
    const {
      brand,
      model,
      condition,
      storage,
      hasCharger,
      description,
      contactEmail,
      contactPhone,
      fullName,
      color,
      expectedPrice
    } = req.body;

    // Validation
    if (!brand || !model || !condition || !storage || !contactEmail || !contactPhone | !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields  (brand, model, condition, storage, contact email, contact phone, and full name)'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Create new sell phone request
    const sellPhoneRequest = new SellPhoneRequest({
      brand,
      model,
      condition,
      storage,
      hasCharger: hasCharger === 'true' || hasCharger === true,
      description,
      contactEmail,
      contactPhone,
      fullName,
      color,
      expectedPrice: expectedPrice ? parseFloat(expectedPrice) : 0,
      phoneImage: req.file ? `/uploads/sell-phones/${req.file.filename}` : null
    });

    const savedRequest = await sellPhoneRequest.save();

    res.status(201).json({
      success: true,
      message: 'Your sell phone request has been submitted successfully! We will review it and get back to you with a quote within 24 hours.',
      data: {
        requestId: savedRequest._id,
        status: savedRequest.status,
        fullName: savedRequest.fullName,
        brand: savedRequest.brand,
        model: savedRequest.model,
      }
    });

  } catch (error) {
    console.error('Error submitting sell phone request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
       ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   GET /api/sell-phone/requests
// @desc    Get all sell phone requests (Admin only)
// @access  Private/Admin
router.get('/requests', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search;

    // Build query
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { contactPhone: { $regex: search, $options: 'i' } }
      ];
    }

    const totalRequests = await SellPhoneRequest.countDocuments(query);
    const requests = await SellPhoneRequest.find(query)
      .populate('reviewedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRequests / limit),
          totalRequests,
          hasNext: page < Math.ceil(totalRequests / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sell phone requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sell-phone/request/:id
// @desc    Get single sell phone request details (Admin only)
// @access  Private/Admin
router.get('/request/:id', adminAuth, async (req, res) => {
  try {
    const request = await SellPhoneRequest.findById(req.params.id)
      .populate('reviewedBy', 'fullName email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Sell phone request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Error fetching sell phone request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sell-phone/request/:id/quote
// @desc    Update sell phone request with quote (Admin only)
// @access  Private/Admin
router.put('/request/:id/quote', adminAuth, async (req, res) => {
  try {
    const { estimatedPrice, adminNotes, status } = req.body;

    if (!estimatedPrice || estimatedPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid estimated price'
      });
    }

    const updatedRequest = await SellPhoneRequest.findByIdAndUpdate(
      req.params.id,
      {
        estimatedPrice,
        adminNotes,
        status: status || 'quoted',
        quotedAt: new Date(),
        reviewedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('reviewedBy', 'fullName email');

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sell phone request not found'
      });
    }

    res.json({
      success: true,
      message: 'Quote updated successfully',
      data: updatedRequest
    });

  } catch (error) {
    console.error('Error updating quote:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/sell-phone/request/:id/status
// @desc    Update sell phone request status (Admin only)
// @access  Private/Admin
router.put('/request/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    const validStatuses = ['pending', 'reviewed', 'quoted', 'accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updatedRequest = await SellPhoneRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNotes,
        reviewedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('reviewedBy', 'fullName email');

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sell phone request not found'
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: updatedRequest
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/sell-phone/request/:id
// @desc    Delete sell phone request (Admin only)
// @access  Private/Admin
router.delete('/request/:id', adminAuth, async (req, res) => {
  try {
    const deletedRequest = await SellPhoneRequest.findByIdAndDelete(req.params.id);

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sell phone request not found'
      });
    }

    res.json({
      success: true,
      message: 'Sell phone request deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting sell phone request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/sell-phone/stats
// @desc    Get sell phone requests stats (Admin only)
// @access  Private/Admin
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalRequests = await SellPhoneRequest.countDocuments();
    const pendingRequests = await SellPhoneRequest.countDocuments({ status: 'pending' });
    const quotedRequests = await SellPhoneRequest.countDocuments({ status: 'quoted' });
    const completedRequests = await SellPhoneRequest.countDocuments({ status: 'completed' });
    
    // Get requests by status
    const statusStats = await SellPhoneRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get requests by brand
    const brandStats = await SellPhoneRequest.aggregate([
      {
        $group: {
          _id: '$brand',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        quotedRequests,
        completedRequests,
        statusStats,
        brandStats
      }
    });

  } catch (error) {
    console.error('Error fetching sell phone stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;