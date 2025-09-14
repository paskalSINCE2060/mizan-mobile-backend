const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Basic phone validation (you can customize this)
        return /^\+?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Email is optional
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  device: {
    type: String,
    required: [true, 'Device model is required'],
    trim: true,
    maxlength: [100, 'Device name cannot exceed 100 characters']
  },
  issue: {
    type: String,
    required: [true, 'Issue description is required'],
    trim: true,
    maxlength: [1000, 'Issue description cannot exceed 1000 characters']
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: {
      validator: function(v) {
        // Check if date is not in the past (allowing today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(v) >= today;
      },
      message: 'Booking date cannot be in the past'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
      message: 'Status must be one of: pending, confirmed, in-progress, completed, cancelled'
    },
    default: 'pending'
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  estimatedCost: {
    type: Number,
    min: [0, 'Estimated cost cannot be negative']
  },
  actualCost: {
    type: Number,
    min: [0, 'Actual cost cannot be negative']
  },
  completionDate: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  serviceType: {
    type: String,
    enum: ['screen-repair', 'battery-replacement', 'water-damage', 'charging-port', 'other'],
    default: 'other'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

// Index for better query performance
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ phone: 1 });

// Virtual for formatted date
bookingSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted creation date
bookingSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to get status color for UI
bookingSchema.methods.getStatusColor = function() {
  const colors = {
    pending: '#ffc107',     // yellow
    confirmed: '#17a2b8',   // blue
    'in-progress': '#fd7e14', // orange
    completed: '#28a745',   // green
    cancelled: '#dc3545'    // red
  };
  return colors[this.status] || '#6c757d';
};

// Method to check if booking is overdue
bookingSchema.methods.isOverdue = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.date < today && this.status !== 'completed' && this.status !== 'cancelled';
};

// Pre-save middleware to update the updatedAt field
bookingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get bookings by status
bookingSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Static method to get overdue bookings
bookingSchema.statics.findOverdue = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.find({
    date: { $lt: today },
    status: { $nin: ['completed', 'cancelled'] }
  }).sort({ date: 1 });
};

// Static method to get today's bookings
bookingSchema.statics.findTodaysBookings = function() {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  return this.find({
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ date: 1 });
};

module.exports = mongoose.model('Booking', bookingSchema);