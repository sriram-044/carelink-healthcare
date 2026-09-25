const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Auth Middleware — Dual-source JWT verification.
 * Priority 1: httpOnly cookie `carelink_auth` (new secure flow)
 * Priority 2: Authorization: Bearer header (backward compatibility for existing API clients)
 *
 * Role is ALWAYS loaded from the database — never trusted from the token payload alone.
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Try httpOnly cookie first (new secure flow)
    let token = req.cookies?.carelink_auth;

    // 2. Fall back to Bearer token (backward compatibility)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided. Access denied.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Always load user from DB so role cannot be manipulated client-side
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
