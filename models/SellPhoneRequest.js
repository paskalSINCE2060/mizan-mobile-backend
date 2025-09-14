// models/SellPhoneRequest.js
const mongoose = require('mongoose');

const sellPhoneRequestSchema = new mongoose.Schema({
  // Phone Details
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  condition: {
    type: String,
    required: true,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  storage: {
    type: String,
    required: true
  },
  hasCharger: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true
  },
  phoneImage: {
    type: String, // URL to uploaded image
    default: null
  },
  color: {
    type: String,
    trim: true
  },
  expectedPrice: {
    type: Number,
    default: 0
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Contact Information
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contactPhone: {
    type: String,
    required: true,
    trim: true
  },
  
  // Admin fields
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'quoted', 'accepted', 'rejected', 'completed'],
    default: 'pending'
  },
  estimatedPrice: {
    type: Number,
    default: 0
  },
  adminNotes: {
    type: String,
    trim: true
  },
  quotedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
sellPhoneRequestSchema.index({ status: 1, createdAt: -1 });
sellPhoneRequestSchema.index({ contactEmail: 1 });

module.exports = mongoose.model('SellPhoneRequest', sellPhoneRequestSchema);