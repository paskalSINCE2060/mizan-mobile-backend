const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/authMiddleware');

// 📱 GET /api/products/category/:category - Get products by specific category
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { limit, sort } = req.query;
        
        console.log(`Fetching products for category: ${category}`); // Debug log
        
        let sortObj = { createdAt: -1 }; // Default: newest first
        if (sort === 'price_asc') sortObj = { price: 1 };
        else if (sort === 'price_desc') sortObj = { price: -1 };
        else if (sort === 'name') sortObj = { name: 1 };
        else if (sort === 'createdAt_desc') sortObj = { createdAt: -1 };
        
        let query = Product.find({ category: category.toLowerCase() });
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const products = await query.sort(sortObj);
        
        console.log(`Found ${products.length} products for category: ${category}`); // Debug log
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching products',
            error: error.message
        });
    }
});

// 🛍️ GET /api/products - Get all products with optional filtering
router.get('/', async (req, res) => {
    try {
        const { category, featured, inStock, limit, sort, search } = req.query;
        
        let filter = {};
        
        // Build filter object
        if (category) filter.category = category.toLowerCase();
        if (featured) filter.featured = featured === 'true';
        if (inStock) filter.inStock = inStock === 'true';  
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
            ];
        }
        
        let sortObj = { createdAt: -1 }; // Default: newest first
        if (sort === 'price_asc') sortObj = { price: 1 };
        else if (sort === 'price_desc') sortObj = { price: -1 };
        else if (sort === 'name') sortObj = { name: 1 };
        
        let query = Product.find(filter);
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const products = await query.sort(sortObj);
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching products',
            error: error.message
        });
    }
});

// 🔍 GET /api/products/:id - Get single product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching product',
            error: error.message
        });
    }
});

// ➕ POST /api/products - Create new product (Admin only)
router.post('/', adminAuth, async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            oldPrice,
            category,
            brand,
            featured,
            inStock,
            image,
            specs
        } = req.body;

        // Validation
        if (!name || !description || !price || !category || !image) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, description, price, category, and image are required'
            });
        }

        // Validate category - UPDATED to include galaxyproducts
        const validCategories = ['smartphone', 'laptop', 'watch', 'earphones', 'premiumsmartphones', 'galaxyproducts'];
        if (!validCategories.includes(category.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid category. Valid categories are: ${validCategories.join(', ')}`
            });
        }

        // Create product
        const product = new Product({
            name: name.trim(),
            description: description.trim(),
            price: Number(price),
            oldPrice: oldPrice ? Number(oldPrice) : undefined,
            category: category.toLowerCase(),
            brand: brand ? brand.trim() : 'Unknown',
            featured: Boolean(featured),
            inStock: Boolean(inStock),
            image,
            specs: specs || {}
        });

        const savedProduct = await product.save();
        
        console.log(`Product created successfully in category: ${savedProduct.category}`); // Debug log
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: savedProduct
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating product',
            error: error.message
        });
    }
});

// ✏️ PUT /api/products/:id - Update product (Admin only)
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            oldPrice,
            category,
            brand,
            featured,
            inStock,
            image,
            specs
        } = req.body;

        // Validate category if provided - UPDATED to include galaxyproducts
        if (category) {
            const validCategories = ['smartphone', 'laptop', 'watch', 'earphones', 'premiumsmartphones', 'galaxyproducts'];
            if (!validCategories.includes(category.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid category. Valid categories are: ${validCategories.join(', ')}`
                });
            }
        }

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (description) updateData.description = description.trim();
        if (price) updateData.price = Number(price);
        if (oldPrice !== undefined) updateData.oldPrice = oldPrice ? Number(oldPrice) : undefined;
        if (category) updateData.category = category.toLowerCase();
        if (brand) updateData.brand = brand.trim();
        if (featured !== undefined) updateData.featured = Boolean(featured);
        if (inStock !== undefined) updateData.inStock = Boolean(inStock);
        if (image) updateData.image = image;
        if (specs) updateData.specs = specs;

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating product',
            error: error.message
        });
    }
});

// 🗑️ DELETE /api/products/:id - Delete product (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully',
            data: product
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting product',
            error: error.message
        });
    }
});

// 📊 GET /api/products/stats/summary - Get product statistics (Admin only)
router.get('/stats/summary', adminAuth, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const featuredProducts = await Product.countDocuments({ featured: true });
        const inStockProducts = await Product.countDocuments({ inStock: true });
        const outOfStockProducts = await Product.countDocuments({ inStock: false });
        
        // Category breakdown
        const categoryStats = await Product.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                totalProducts,
                featuredProducts,
                inStockProducts,
                outOfStockProducts,
                categoryBreakdown: categoryStats
            }
        });
    } catch (error) {
        console.error('Error fetching product stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching product statistics',
            error: error.message
        });
    }
});

module.exports = router;