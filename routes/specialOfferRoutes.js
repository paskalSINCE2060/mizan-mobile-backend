const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const SpecialOffer = require('../models/SpecialOffer');

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads/special-offers';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'offer-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// GET all special offers
router.get('/', async (req, res) => {
  try {
    const { status, category, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (status) filter.isActive = status === 'active';
    if (category && category !== 'All Brands') filter.category = category;

    const skip = (page - 1) * limit;
    
    const offers = await SpecialOffer.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await SpecialOffer.countDocuments(filter);

    // Return offers array directly for better compatibility with frontend
    res.json(offers);
  } catch (error) {
    console.error('Error fetching special offers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch special offers',
      error: error.message
    });
  }
});

// GET single special offer
router.get('/:id', async (req, res) => {
  try {
    const offer = await SpecialOffer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Special offer not found'
      });
    }

    res.json({
      success: true,
      offer
    });
  } catch (error) {
    console.error('Error fetching special offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch special offer',
      error: error.message
    });
  }
});

// POST create new special offer
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('Creating special offer:', req.body);
    
    const {
      title,
      description,
      discount,
      discountType,
      discountValue,
      validFrom,
      validUntil,
      category,
      promoCode,
      isActive,
      redemptionSteps,
      productDetails,
      maxRedemptions,
      targetProducts
    } = req.body;

    // Validate required fields
    if (!title || !description || !discount || !validFrom || !validUntil || !category || !promoCode) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Parse JSON fields safely
    let parsedRedemptionSteps = [];
    let parsedProductDetails = {};
    let parsedTargetProducts = [];

    try {
      parsedRedemptionSteps = redemptionSteps ? JSON.parse(redemptionSteps) : [];
      parsedProductDetails = productDetails ? JSON.parse(productDetails) : {};
      parsedTargetProducts = targetProducts ? JSON.parse(targetProducts) : [];
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data in request'
      });
    }

    // Check for duplicate promo codes
    const existingOffer = await SpecialOffer.findOne({ 
      promoCode: promoCode.toUpperCase()
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists. Please use a different code.'
      });
    }

    // Validate dates
    const validFromDate = new Date(validFrom);
    const validUntilDate = new Date(validUntil);
    
    if (validFromDate >= validUntilDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid Until date must be after Valid From date'
      });
    }

    const newOffer = new SpecialOffer({
      title: title.trim(),
      description: description.trim(),
      discount: discount.trim(),
      discountType: discountType || 'percentage',
      discountValue: parseFloat(discountValue) || 0,
      validFrom: validFromDate,
      validUntil: validUntilDate,
      category: category.trim(),
      promoCode: promoCode.toUpperCase().trim(),
      isActive: isActive === 'true' || isActive === true,
      redemptionSteps: parsedRedemptionSteps.filter(step => step.trim() !== ''),
      productDetails: parsedProductDetails,
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
      targetProducts: parsedTargetProducts,
      currentRedemptions: 0,
      image: req.file ? `/uploads/special-offers/${req.file.filename}` : null
    });

    const savedOffer = await newOffer.save();
    
    console.log('Special offer created successfully:', savedOffer._id);
    
    res.status(201).json({ 
      success: true, 
      message: 'Special offer created successfully! 🎉',
      offer: savedOffer 
    });
  } catch (error) {
    console.error('Error creating special offer:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + errors.join(', ')
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists. Please use a different code.'
      });
    }

    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create special offer' 
    });
  }
});

// PUT update special offer
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    console.log('Updating special offer:', req.params.id);
    
    const {
      title,
      description,
      discount,
      discountType,
      discountValue,
      validFrom,
      validUntil,
      category,
      promoCode,
      isActive,
      redemptionSteps,
      productDetails,
      maxRedemptions,
      targetProducts
    } = req.body;

    // Check if offer exists
    const existingOffer = await SpecialOffer.findById(req.params.id);
    if (!existingOffer) {
      return res.status(404).json({
        success: false,
        message: 'Special offer not found'
      });
    }

    // Check for duplicate promo codes (excluding current offer)
    if (promoCode && promoCode.toUpperCase() !== existingOffer.promoCode) {
      const duplicateOffer = await SpecialOffer.findOne({ 
        promoCode: promoCode.toUpperCase(),
        _id: { $ne: req.params.id }
      });

      if (duplicateOffer) {
        return res.status(400).json({
          success: false,
          message: 'Promo code already exists. Please use a different code.'
        });
      }
    }

    // Parse JSON fields safely
    let parsedRedemptionSteps = existingOffer.redemptionSteps;
    let parsedProductDetails = existingOffer.productDetails;
    let parsedTargetProducts = existingOffer.targetProducts;

    try {
      if (redemptionSteps) parsedRedemptionSteps = JSON.parse(redemptionSteps);
      if (productDetails) parsedProductDetails = JSON.parse(productDetails);
      if (targetProducts) parsedTargetProducts = JSON.parse(targetProducts);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data in request'
      });
    }

    // Validate dates if provided
    if (validFrom && validUntil) {
      const validFromDate = new Date(validFrom);
      const validUntilDate = new Date(validUntil);
      
      if (validFromDate >= validUntilDate) {
        return res.status(400).json({
          success: false,
          message: 'Valid Until date must be after Valid From date'
        });
      }
    }

    // Update fields
    const updateData = {
      title: title ? title.trim() : existingOffer.title,
      description: description ? description.trim() : existingOffer.description,
      discount: discount ? discount.trim() : existingOffer.discount,
      discountType: discountType || existingOffer.discountType,
      discountValue: discountValue ? parseFloat(discountValue) : existingOffer.discountValue,
      validFrom: validFrom ? new Date(validFrom) : existingOffer.validFrom,
      validUntil: validUntil ? new Date(validUntil) : existingOffer.validUntil,
      category: category ? category.trim() : existingOffer.category,
      promoCode: promoCode ? promoCode.toUpperCase().trim() : existingOffer.promoCode,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : existingOffer.isActive,
      redemptionSteps: parsedRedemptionSteps.filter(step => step.trim() !== ''),
      productDetails: parsedProductDetails,
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : existingOffer.maxRedemptions,
      targetProducts: parsedTargetProducts
    };

    // Handle image update
    if (req.file) {
      // Delete old image if it exists
      if (existingOffer.image) {
        const oldImagePath = path.join(__dirname, '..', existingOffer.image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
          }
        }
      }
      updateData.image = `/uploads/special-offers/${req.file.filename}`;
    }

    const updatedOffer = await SpecialOffer.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('Special offer updated successfully:', updatedOffer._id);

    res.json({
      success: true,
      message: 'Special offer updated successfully! 🎉',
      offer: updatedOffer
    });
  } catch (error) {
    console.error('Error updating special offer:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + errors.join(', ')
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists. Please use a different code.'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update special offer'
    });
  }
});

// PATCH toggle offer status
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const updatedOffer = await SpecialOffer.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );

    if (!updatedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Special offer not found'
      });
    }

    res.json({
      success: true,
      message: `Offer ${isActive ? 'activated' : 'deactivated'} successfully! 🎉`,
      offer: updatedOffer
    });
  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update offer status'
    });
  }
});

// DELETE special offer
router.delete('/:id', async (req, res) => {
  try {
    const offer = await SpecialOffer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Special offer not found'
      });
    }

    // Delete associated image file
    if (offer.image) {
      const imagePath = path.join(__dirname, '..', offer.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (deleteError) {
          console.error('Error deleting image file:', deleteError);
        }
      }
    }

    await SpecialOffer.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Special offer deleted successfully! 🎉'
    });
  } catch (error) {
    console.error('Error deleting special offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete special offer'
    });
  }
});

// POST redeem promo code
router.post('/redeem/:promoCode', async (req, res) => {
  try {
    const { promoCode } = req.params;
    const { productId } = req.body;

    const offer = await SpecialOffer.findOne({ 
      promoCode: promoCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired promo code'
      });
    }

    // Check if max redemptions reached
    if (offer.maxRedemptions && offer.currentRedemptions >= offer.maxRedemptions) {
      return res.status(400).json({
        success: false,
        message: 'This offer has reached its maximum redemption limit'
      });
    }

    // Check if offer applies to specific products
    if (offer.targetProducts.length > 0 && productId) {
      if (!offer.targetProducts.includes(productId)) {
        return res.status(400).json({
          success: false,
          message: 'This offer is not applicable to the selected product'
        });
      }
    }

    // Increment redemption count
    offer.currentRedemptions = (offer.currentRedemptions || 0) + 1;
    await offer.save();

    res.json({
      success: true,
      message: 'Promo code applied successfully! 🎉',
      offer: {
        title: offer.title,
        discount: offer.discount,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        productDetails: offer.productDetails
      }
    });
  } catch (error) {
    console.error('Error redeeming promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to redeem promo code'
    });
  }
});

// GET active offers for public display
router.get('/public/active', async (req, res) => {
  try {
    const { category, limit = 10 } = req.query;
    
    const filter = {
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    };

    if (category && category !== 'All Brands') {
      filter.category = category;
    }

    const offers = await SpecialOffer.find(filter)
      .select('title description discount category image validUntil promoCode productDetails')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      offers
    });
  } catch (error) {
    console.error('Error fetching active offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active offers'
    });
  }
});

// GET offer statistics
router.get('/stats', async (req, res) => {
  try {
    const totalOffers = await SpecialOffer.countDocuments();
    const activeOffers = await SpecialOffer.countDocuments({ isActive: true });
    const expiredOffers = await SpecialOffer.countDocuments({ 
      validUntil: { $lt: new Date() } 
    });
    const validOffers = await SpecialOffer.countDocuments({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    res.json({
      success: true,
      stats: {
        total: totalOffers,
        active: activeOffers,
        expired: expiredOffers,
        valid: validOffers
      }
    });
  } catch (error) {
    console.error('Error fetching offer statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offer statistics'
    });
  }
});

module.exports = router;