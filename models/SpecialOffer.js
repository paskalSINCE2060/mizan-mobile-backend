const mongoose = require('mongoose');

const specialOfferSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  discount: { 
    type: String, 
    required: true,
    trim: true
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    default: 'percentage' 
  },
  discountValue: { 
    type: Number, 
    required: true,
    min: 0
  },
  validFrom: { 
    type: Date, 
    required: true 
  },
  validUntil: { 
    type: Date, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    trim: true
  },
  promoCode: { 
    type: String, 
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 20
  },
  image: { 
    type: String,
    default: null
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  redemptionSteps: [{
    type: String,
    trim: true
  }],
  productDetails: {
    name: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      min: 0
    },
    discountedPrice: {
      type: Number,
      min: 0
    },
    originalPrice: {
      type: Number,
      min: 0
    },
    specs: {
      type: String,
      trim: true
    }
  },
  maxRedemptions: {
    type: Number,
    min: 1,
    default: null
  },
  currentRedemptions: { 
    type: Number, 
    default: 0,
    min: 0
  },
  targetProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if offer is expired
specialOfferSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for checking if offer is valid now
specialOfferSchema.virtual('isValidNow').get(function() {
  const now = new Date();
  return this.isActive && now >= this.validFrom && now <= this.validUntil;
});

// Virtual for remaining redemptions
specialOfferSchema.virtual('remainingRedemptions').get(function() {
  if (!this.maxRedemptions) return null;
  return Math.max(0, this.maxRedemptions - this.currentRedemptions);
});

// Index for performance
specialOfferSchema.index({ promoCode: 1 });
specialOfferSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
specialOfferSchema.index({ category: 1 });

// Pre-save middleware to validate dates
specialOfferSchema.pre('save', function(next) {
  if (this.validFrom >= this.validUntil) {
    return next(new Error('Valid Until date must be after Valid From date'));
  }
  
  if (this.maxRedemptions && this.currentRedemptions > this.maxRedemptions) {
    return next(new Error('Current redemptions cannot exceed maximum redemptions'));
  }
  
  next();
});

module.exports = mongoose.model('SpecialOffer', specialOfferSchema);