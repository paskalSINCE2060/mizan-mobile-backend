const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxLength: [200, 'Product name cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
        trim: true,
        maxLength: [2000, 'Description cannot exceed 2000 characters']
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: [0, 'Price cannot be negative']
    },
    oldPrice: {
        type: Number,
        min: [0, 'Old price cannot be negative'],
        // validate: {
        //     validator: function(value) {
        //         // If oldPrice is provided, it should be greater than current price
        //         return !value || value > this.price;
        //     },
        //     message: 'Old price should be greater than current price'
        // }
    },
    category: {
        type: String,
        required: [true, 'Product category is required'],
        enum: {
            values: ['smartphone', 'laptop', 'watch', 'earphones', 'premiumsmartphones', 'galaxyproducts'],
            message: 'Category must be one of: smartphone, laptop, watch, earphones, premiumsmartphones, galaxyproducts'
        },
        lowercase: true,
        trim: true
    },
    brand: {
        type: String,
        trim: true,
        default: 'Unknown',
        maxLength: [50, 'Brand name cannot exceed 50 characters']
    },
    featured: {
        type: Boolean,
        default: false
    },
    inStock: {
        type: Boolean,
        default: true
    },
    image: {
        type: String,
        required: [true, 'Product image is required'],
        trim: true
    },
    specs: {
        storage: {
            type: String,
            trim: true,
            default: ''
        },
        display: {
            type: String,
            trim: true,
            default: ''
        },
        battery: {
            type: String,
            trim: true,
            default: ''
        },
        camera: {
            type: String,
            trim: true,
            default: ''
        },
        connectivity: {
            type: String,
            trim: true,
            default: ''
        },
        features: {
            type: String,
            trim: true,
            default: ''
        },
        sensors: {
            type: String,
            trim: true,
            default: ''
        },
        color: {
            type: String,
            trim: true,
            default: ''
        }
    },
    // Additional fields for future use
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    views: {
        type: Number,
        default: 0,
        min: 0
    },
    sales: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    versionKey: false // Removes __v field
});

// Indexes for better query performance
productSchema.index({ category: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ inStock: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

// Compound indexes for common queries
productSchema.index({ category: 1, featured: 1 });
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ category: 1, price: 1 });

// Text search index for search functionality
productSchema.index({
    name: 'text',
    description: 'text',
    brand: 'text'
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
    if (this.oldPrice && this.oldPrice > this.price) {
        return Math.round(((this.oldPrice - this.price) / this.oldPrice) * 100);
    }
    return 0;
});

// Virtual for savings amount
productSchema.virtual('savingsAmount').get(function() {
    if (this.oldPrice && this.oldPrice > this.price) {
        return this.oldPrice - this.price;
    }
    return 0;
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Pre-save middleware to ensure category is lowercase
productSchema.pre('save', function(next) {
    if (this.category) {
        this.category = this.category.toLowerCase();
    }
    next();
});

// Pre-update middleware to ensure category is lowercase
productSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
    const update = this.getUpdate();
    if (update && update.category) {
        update.category = update.category.toLowerCase();
    }
    next();
});

// Static method to get products by category
productSchema.statics.findByCategory = function(category, options = {}) {
    const { limit, sort = { createdAt: -1 } } = options;
    let query = this.find({ category: category.toLowerCase() });
    
    if (limit) {
        query = query.limit(limit);
    }
    
    return query.sort(sort);
};

// Static method to get featured products
productSchema.statics.findFeatured = function(category = null, limit = null) {
    let filter = { featured: true };
    if (category) {
        filter.category = category.toLowerCase();
    }
    
    let query = this.find(filter);
    if (limit) {
        query = query.limit(limit);
    }
    
    return query.sort({ createdAt: -1 });
};

// Static method to get Galaxy products specifically
productSchema.statics.findGalaxyProducts = function(limit = null) {
    let query = this.find({ category: 'galaxyproducts' });
    
    if (limit) {
        query = query.limit(limit);
    }
    
    return query.sort({ createdAt: -1 });
};

// Instance method to increment views
productSchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Instance method to increment sales
productSchema.methods.incrementSales = function() {
    this.sales += 1;
    return this.save();
};

module.exports = mongoose.model('Product', productSchema);