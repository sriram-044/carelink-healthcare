const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided. Access denied.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found. Token invalid.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token expired or invalid.' });
  }
};

module.exports = authMiddleware;
