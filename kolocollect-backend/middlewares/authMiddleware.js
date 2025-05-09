const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const refreshToken = req.cookies?.refreshToken;

    if (!accessToken && !refreshToken) {
      return res.status(401).json({ message: 'No tokens provided' });
    }

    try {
      // Verify access token first
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      req.user = user;
      return next();
    } catch (accessErr) {
      // Handle expired access token with refresh token
      if (accessErr.name === 'TokenExpiredError' && refreshToken) {
        const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        const user = await User.findById(decodedRefresh.id);

        // Generate new access token
        const newAccessToken = jwt.sign(
          { id: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        // Set new access token in response header
        res.set('New-Access-Token', newAccessToken);
        req.user = user;
        return next();
      }
      throw accessErr;
    }
  } catch (err) {
    console.error('Authentication error:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired - please refresh' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Authentication failed' });
  }
}
module.exports = authMiddleware;
