const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Step 1: Redirect user to Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Step 2: Google redirects back here after auth
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google_failed' }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token and user info in URL
    const userInfo = encodeURIComponent(JSON.stringify({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    }));

    res.redirect(`/auth-success.html?token=${token}&user=${userInfo}`);
  }
);

module.exports = router;
