const Product = require('../models/Product');

// GET all products with filtering and pagination
const getProducts = async (req, res) => {
  try {
    const { 
      category, 
      featured, 
      inStock, 
      brand, 
      minPrice, 
      maxPrice, 
      limit, 
      page, 
      sort,
      search 
    } = req.query;
    
    // Build query object
    let query = {};
    
    if (category) query.category = category.toLowerCase();
    if (featured !== undefined) query.featured = featured === 'true';
    if (inStock !== undefined) query.inStock = inStock === 'true';
    if (brand) query.brand = new RegExp(brand, 'i');
    
    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    // Text search
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') }
      ];
    }
    
    // Sort options
    let sortObj = { createdAt: -1 }; // Default: newest first
    if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };
    else if (sort === 'name') sortObj = { name: 1 };
    else if (sort === 'featured') sortObj = { featured: -1, createdAt: -1 };
    
    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 0;
    const skip = limitNum > 0 ? (pageNum - 1) * limitNum : 0;
    
    let productQuery = Product.find(query).sort(sortObj);
    
    if (limitNum > 0) {
      productQuery = productQuery.skip(skip).limit(limitNum);
    }
    
    const products = await productQuery;
    const totalProducts = await Product.countDocuments(query);
    
    res.json({
      success: true,
      count: products.length,
      total: totalProducts,
      page: pageNum,
      pages: limitNum > 0 ? Math.ceil(totalProducts / limitNum) : 1,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get products',
      error: error.message 
    });
  }
};

// GET single product by ID
const getProductById = async (req, res) => {
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
      message: 'Failed to get product',
      error: error.message 
    });
  }
};

// GET products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit, sort } = req.query;
    
    let sortObj = { createdAt: -1 }; // Default: newest first
    if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };
    else if (sort === 'name') sortObj = { name: 1 };
    else if (sort === 'createdAt_desc') sortObj = { createdAt: -1 };
    else if (sort === 'createdAt_asc') sortObj = { createdAt: 1 };
    
    // Handle all categories including galaxyproducts
    let categoryQuery;
    if (category.toLowerCase() === 'premiumsmartphones') {
      categoryQuery = { category: 'premiumsmartphones' };
    } else if (category.toLowerCase() === 'galaxyproducts') {
      categoryQuery = { category: 'galaxyproducts' };
    } else {
      categoryQuery = { category: category.toLowerCase() };
    }
    
    let query = Product.find(categoryQuery).sort(sortObj);
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const products = await query;
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

// POST create a new product
const createProduct = async (req, res) => {
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
        message: 'Required fields: name, description, price, category, image'
      });
    }

    // Create product
    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      oldPrice: oldPrice ? Number(oldPrice) : undefined,
      category: category.toLowerCase(),
      brand: brand?.trim() || 'Unknown',
      featured: Boolean(featured),
      inStock: Boolean(inStock),
      image,
      specs: specs || {}
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

// PUT update a product
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Update fields
    const updateFields = [
      'name', 'description', 'price', 'oldPrice', 'category', 
      'brand', 'featured', 'inStock', 'image', 'specs'
    ];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'category') {
          product[field] = req.body[field].toLowerCase();
        } else if (field === 'price' || field === 'oldPrice') {
          product[field] = Number(req.body[field]);
        } else if (field === 'featured' || field === 'inStock') {
          product[field] = Boolean(req.body[field]);
        } else {
          product[field] = req.body[field];
        }
      }
    });
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

// DELETE a product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    await Product.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

// GET featured products
const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8, category } = req.query;
    
    let query = { featured: true, inStock: true };
    if (category) {
      query.category = category.toLowerCase();
    }
    
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured products',
      error: error.message
    });
  }
};

// GET Galaxy products specifically
const getGalaxyProducts = async (req, res) => {
  try {
    const { limit = 10, sort } = req.query;
    
    let sortObj = { createdAt: -1 }; // Default: newest first
    if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };
    else if (sort === 'name') sortObj = { name: 1 };
    
    let query = Product.find({ category: 'galaxyproducts' }).sort(sortObj);
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const products = await query;
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching Galaxy products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Galaxy products',
      error: error.message
    });
  }
};

module.exports = { 
  getProducts, 
  getProductById,
  getProductsByCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getGalaxyProducts
};