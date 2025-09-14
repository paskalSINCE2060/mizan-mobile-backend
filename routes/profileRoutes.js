// Fixed profileRoutes.js - Complete solution for ReferenceError: email is not defined

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User'); // Assuming you have a User model

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profile-images';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
    }
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  console.log('=== AUTHENTICATION MIDDLEWARE ===');
  const authHeader = req.headers['authorization'];
  console.log('Auth header:', authHeader);
  
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Extracted token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('JWT decoded user:', user);
    req.user = user;
    next();
  });
};

// Helper function to validate date
const isValidDate = (dateString) => {
  if (!dateString || dateString.trim() === '') return true; // Empty dates are valid
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// Helper function to compare dates (ignoring time)
const isDateInFuture = (dateString) => {
  if (!dateString || dateString.trim() === '') return false; // Empty dates are not in future
  const inputDate = new Date(dateString);
  const today = new Date();
  
  // Set both dates to start of day for fair comparison
  inputDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  return inputDate > today;
};

// Test route
router.get('/test-no-auth', (req, res) => {
  res.json({ message: 'Profile routes loaded successfully!' });
});

// GET /api/users/:id - Get user profile
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.user.id || req.user._id || req.user.userId;
    
    console.log('=== GET USER PROFILE ===');
    console.log('Requesting user ID:', requestingUserId);
    console.log('Target user ID:', userId);
    console.log('User from token:', req.user);
    
    // Check if user is requesting their own profile or has admin rights
    if (requestingUserId !== userId && req.user.role !== 'admin') {
      console.log('Access denied - not own profile or admin');
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      console.log('User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found:', user);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id - Update user profile (COMPLETELY FIXED VERSION)
router.put('/users/:id', authenticateToken, async (req, res) => {
  console.log('=== UPDATE USER PROFILE START ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.originalUrl);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  try {
    const userId = req.params.id;
    const requestingUserId = req.user.id || req.user._id || req.user.userId;
    
    console.log('Update request - Requesting user ID:', requestingUserId);
    console.log('Update request - Target user ID:', userId);
    console.log('Update request - User from token:', req.user);
    console.log('Update request - Raw body:', JSON.stringify(req.body, null, 2));
    
    // Check if user is updating their own profile
    if (requestingUserId !== userId) {
      console.log('ACCESS DENIED: User trying to update different profile');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if User model is available
    if (!User) {
      console.error('User model is not available');
      return res.status(500).json({ error: 'Database model not available' });
    }

    // First, let's check if the user exists
    console.log('Checking if user exists...');
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      console.log('User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Existing user found:', existingUser);

    // Extract fields from request body - FIXED: Only destructure what's actually sent
    const requestBody = req.body || {};
    const {
      fullName,
      dateOfBirth,
      location,
      bio,
      gender,
    } = requestBody;

    console.log('Extracted fields:');
    console.log('- fullName:', fullName);
    console.log('- dateOfBirth:', dateOfBirth);
    console.log('- location:', location);
    console.log('- bio:', bio);
    console.log('- gender:', gender);

    // Validate required fields
    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      console.log('Validation failed: fullName is required');
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Validate date of birth if provided
    if (dateOfBirth && dateOfBirth.trim() !== '') {
      console.log('Validating date of birth:', dateOfBirth);
      
      if (!isValidDate(dateOfBirth)) {
        console.log('Invalid date format');
        return res.status(400).json({ error: 'Invalid date format' });
      }
      
      if (isDateInFuture(dateOfBirth)) {
        console.log('Date is in the future');
        return res.status(400).json({ error: 'Date of birth cannot be in the future' });
      }
      
      // Additional validation: check if date is reasonable (not too old)
      const dobDate = new Date(dateOfBirth);
      const currentYear = new Date().getFullYear();
      const birthYear = dobDate.getFullYear();
      
      if (currentYear - birthYear > 150) {
        console.log('Date is too old');
        return res.status(400).json({ error: 'Please enter a valid date of birth' });
      }
    }

    // Prepare update data - FIXED: Build object safely
    const updateData = {
      fullName: fullName.trim(),
      updatedAt: new Date()
    };

    console.log('Base update data:', updateData);

    // Add optional fields only if they are provided and not undefined
    if (dateOfBirth !== undefined && dateOfBirth !== null) {
      updateData.dateOfBirth = dateOfBirth.trim();
      console.log('Added dateOfBirth to update data');
    }

    if (location !== undefined && location !== null) {
      updateData.location = location.trim();
      console.log('Added location to update data');
    }

    if (bio !== undefined && bio !== null) {
      updateData.bio = bio.trim();
      console.log('Added bio to update data');
    }

    if (gender !== undefined && gender !== null) {
      updateData.gender = gender.trim();
      console.log('Added gender to update data');
    }

    console.log('Final update data being applied:', JSON.stringify(updateData, null, 2));

    // Attempt to update user profile
    console.log('Attempting to update user...');
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,
        runValidators: true,
        upsert: false
      }
    ).select('-password');

    if (!updatedUser) {
      console.log('User not found after update attempt');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Profile updated successfully:', updatedUser);
    console.log('=== UPDATE USER PROFILE SUCCESS ===');
    res.json(updatedUser);

  } catch (error) {
    console.error('=== UPDATE USER PROFILE ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      console.log('Mongoose validation error:', error.errors);
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: validationErrors.join(', ') });
    }
    
    if (error.name === 'CastError') {
      console.log('Mongoose cast error:', error);
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    if (error.code === 11000) {
      console.log('Duplicate key error:', error);
      return res.status(400).json({ error: 'Duplicate field value' });
    }
    
    console.log('Sending generic 500 error');
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/users/:id/upload-avatar - Upload profile image
router.post('/users/:id/upload-avatar', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.user.id || req.user._id || req.user.userId;
    
    console.log('=== UPLOAD AVATAR ===');
    console.log('Upload request - Requesting user ID:', requestingUserId);
    console.log('Upload request - Target user ID:', userId);
    
    // Check if user is updating their own profile
    if (requestingUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current user to check for existing profile image
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old profile image if it exists
    if (currentUser.profileImage && currentUser.profileImage.startsWith('/uploads/')) {
      const oldImagePath = path.join(__dirname, '..', currentUser.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Generate the URL for the uploaded image
    const profileImageUrl = `/uploads/profile-images/${req.file.filename}`;
    
    console.log('Setting profile image URL:', profileImageUrl);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        profileImage: profileImageUrl,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Profile image updated successfully:', updatedUser.profileImage);
    res.json({ 
      profileImage: updatedUser.profileImage,
      message: 'Profile image updated successfully'
    });
  } catch (error) {
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    console.error('Error uploading profile image:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
    }
    
    if (error.message === 'Invalid file type. Only JPEG, PNG, and GIF are allowed.') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;