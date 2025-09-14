// models/CheckoutOrder.js
const mongoose = require('mongoose');

const checkoutOrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderNumber: {
    type: String,
    unique: true,
    required: true,
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true, // This will now also store COD order numbers
  },
  customerDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  products: [
    {
      productId: { type: String, required: true },
      name: { type: String, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      specialOffer: {
        id: String,
        title: String,
        discountPercentage: Number,
      },
    },
  ],
  pricing: {
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash_on_delivery'],
    default: 'cash_on_delivery',
  },
  adminNotes: {
    type: String,
    default: '',
  },
  // Additional fields for better tracking
  deliveryDate: {
    type: Date,
    default: null,
  },
  trackingNumber: {
    type: String,
    default: '',
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancelReason: {
    type: String,
    default: '',
  },
}, { 
  timestamps: true 
});

// Pre-save middleware to generate order number if not provided
checkoutOrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = `COD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

// Index for efficient querying
checkoutOrderSchema.index({ stripeSessionId: 1 });
checkoutOrderSchema.index({ orderNumber: 1 });
checkoutOrderSchema.index({ user: 1 });
checkoutOrderSchema.index({ paymentStatus: 1 });
checkoutOrderSchema.index({ orderStatus: 1 });
checkoutOrderSchema.index({ paymentMethod: 1 });
checkoutOrderSchema.index({ createdAt: -1 });

// Virtual for order age in days
checkoutOrderSchema.virtual('orderAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Instance method to check if order can be cancelled
checkoutOrderSchema.methods.canBeCancelled = function() {
  return ['pending', 'processing'].includes(this.orderStatus);
};

// Instance method to format order number for display
checkoutOrderSchema.methods.getDisplayOrderNumber = function() {
  return this.orderNumber || this.stripeSessionId;
};

module.exports = mongoose.model('CheckoutOrder', checkoutOrderSchema);