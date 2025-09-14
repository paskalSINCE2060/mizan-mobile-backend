const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path as needed

// ✅ General authentication middleware
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 Auth header:', authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No token provided in Authorization header');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('🎟️ Token extracted:', token ? `${token.substring(0, 20)}...` : 'No token');

    if (!token) {
      console.log('❌ Empty token');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', decoded);

    // Find user in database
    const user = await User.findById(decoded.userId || decoded.id);
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.name, error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// 🔒 Admin-only authentication middleware
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 Admin auth header:', authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No token provided in Authorization header');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('🎟️ Admin token extracted:', token ? `${token.substring(0, 20)}...` : 'No token');

    if (!token) {
      console.log('❌ Empty token');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Admin token decoded:', decoded);

    // Find user in database
    const user = await User.findById(decoded.userId || decoded.id);
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Check if user is admin
    if (user.role !== 'admin' && !user.isAdmin) {
      console.log('❌ User is not admin. Role:', user.role, 'isAdmin:', user.isAdmin);
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    console.log('✅ Admin authentication successful');
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('❌ Admin auth error:', error.name, error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

module.exports = { auth, adminAuth };