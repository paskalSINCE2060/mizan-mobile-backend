const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      _id: user._id.toString(),
      email: user.email,
      role: user.role || 'user',
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Signup Route
router.post('/signup', async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  try {
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
      fullName,
      email: email.toLowerCase(),
      phone,
      password, // Assumes hashing in model via pre-save
    });
    await user.save();

    // Fetch the latest user info excluding password
    const latestUser = await User.findById(user._id).select('-password');

    const token = generateToken(latestUser);

    res.status(201).json({
      message: 'Signup successful',
      token,
      user: {
        id: latestUser._id.toString(),
        _id: latestUser._id.toString(),
        email: latestUser.email,
        fullName: latestUser.fullName,
        phone: latestUser.phone || latestUser.number,
        number: latestUser.number || latestUser.phone,
        dateOfBirth: latestUser.dateOfBirth,
        location: latestUser.location,
        bio: latestUser.bio,
        gender: latestUser.gender,
        profileImage: latestUser.profileImage,
        role: latestUser.role || 'user',
        createdAt: latestUser.createdAt,
        updatedAt: latestUser.updatedAt,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Fetch latest user data after successful auth
    const latestUser = await User.findById(user._id).select('-password');
    if (!latestUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = generateToken(latestUser);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: latestUser._id.toString(),
        _id: latestUser._id.toString(),
        email: latestUser.email,
        fullName: latestUser.fullName,
        phone: latestUser.phone || latestUser.number,
        number: latestUser.number || latestUser.phone,
        dateOfBirth: latestUser.dateOfBirth,
        location: latestUser.location,
        bio: latestUser.bio,
        gender: latestUser.gender,
        profileImage: latestUser.profileImage,
        role: latestUser.role || 'user',
        createdAt: latestUser.createdAt,
        updatedAt: latestUser.updatedAt,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Refresh Token Route
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token missing' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newAccessToken = generateToken(user);
    const newRefreshToken = generateToken(user); // You can use a different secret if needed

    res.status(200).json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || user.number,
        number: user.number || user.phone,
        dateOfBirth: user.dateOfBirth,
        location: user.location,
        bio: user.bio,
        gender: user.gender,
        profileImage: user.profileImage,
        role: user.role || 'user',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});


module.exports = router;
