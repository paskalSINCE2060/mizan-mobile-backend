// models/PhoneOrder.js
const mongoose = require('mongoose');

const phoneOrderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  storage: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  paymentMethod: {
    type: String,
    enum: ['full', 'installment'],
    default: 'full'
  },
  deliveryMethod: {
    type: String,
    enum: ['pickup', 'delivery'],
    default: 'pickup'
  },
  address: {
    type: String,
    default: ''
  },
  preferredDate: {
    type: String,
    default: ''
  },
  preferredTime: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  budget: {
    type: String,
    default: ''
  },
  priority: {
    type: String,
    enum: ['standard', 'express', 'urgent'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('PhoneOrder', phoneOrderSchema);