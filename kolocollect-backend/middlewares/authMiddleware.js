const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios');

const authMiddleware = async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const refreshToken = req.cookies?.refreshToken;

    if (!accessToken && !refreshToken) {
      return res.status(401).json({ message: 'No tokens provided' });
    }

    try {
      // First try to verify token with our own secret
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          req.user = user;
          return next();
        }
      } catch (localVerifyError) {
        // If local verification fails, try with auth service
        console.log('Local token verification failed, trying with auth service');
      }      // Verify with external auth service
      try {
        const authServiceUrl = process.env.AUTH_SERVICE_URL || 'https://auth-service-5971.onrender.com';
        console.log('Verifying token with auth service:', authServiceUrl);        const verifyResponse = await axios.post(`${authServiceUrl}/api/auth/verify`, { token: accessToken });
        console.log('Token validation response:', verifyResponse.data);
          if (verifyResponse.data && (verifyResponse.data.valid || verifyResponse.data.isValid || verifyResponse.data.success === true)) {
          // Token is valid according to auth service - handle all response formats
          const userId = verifyResponse.data.userId || verifyResponse.data.sub || verifyResponse.data.id;
          console.log('Token verified successfully, userId:', userId);
          
          // Try to find user by authId first
          let user = await User.findOne({ authId: userId });
          
          // If not found by authId, try to find by decoded token's userId or direct ID match
          if (!user) {
            try {
              // Try with decoded token
              const decodedToken = jwt.decode(accessToken);
              if (decodedToken && decodedToken.userId) {
                user = await User.findById(decodedToken.userId);
              }
              
              // If still not found, try direct ID match
              if (!user) {
                user = await User.findById(userId);
              }
              
              // If found, update authId for future searches
              if (user && !user.authId) {
                user.authId = userId;
                await user.save();
              }
            } catch (decodeErr) {
              console.error('Error decoding token:', decodeErr);
            }
          }
          
          if (!user) {
            return res.status(401).json({ message: 'User not found in local database' });
          }
          
          req.user = user;
          return next();
        } else {
          console.log('Token validation response failed validation check:', verifyResponse.data);
          throw new Error('Token validation failed');
        }      } catch (verifyError) {
        console.error('Error verifying token with auth service:', verifyError.message);
        
        // Check if there's a response from the auth service despite the error
        if (verifyError.response && verifyError.response.data) {
          console.log('Auth service response data:', verifyError.response.data);
          
          // If the response contains success=true, consider it valid
          if (verifyError.response.data.success === true) {
            const userId = verifyError.response.data.userId;
            console.log('Token is actually valid from response data, userId:', userId);
            
            // Find user
            let user = await User.findOne({ authId: userId });
            if (!user) {
              user = await User.findById(userId);
              if (user && !user.authId) {
                user.authId = userId;
                await user.save();
              }
            }
            
            if (user) {
              req.user = user;
              return next();
            }
          }
        }
        
        throw new Error('Token validation failed: ' + verifyError.message);
      }
    } catch (accessErr) {      // Handle expired access token with refresh token
      if (accessErr.name === 'TokenExpiredError' && refreshToken) {
        try {
          // Try to use refresh token with our local verification first
          try {
            const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
            const user = await User.findById(decodedRefresh.id);
            if (user) {
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
          } catch (localRefreshError) {
            console.log('Local refresh token verification failed, trying with auth service');
          }

          // Try refreshing with external auth service
          const authServiceUrl = process.env.AUTH_SERVICE_URL || 'https://auth-service-5971.onrender.com';
          const refreshResponse = await axios.post(`${authServiceUrl}/api/auth/refresh`, { refreshToken });
          
          if (refreshResponse.data && refreshResponse.data.accessToken) {
            // Get user info from new token
            const verifyResponse = await axios.post(`${authServiceUrl}/api/auth/verify`, 
              { token: refreshResponse.data.accessToken });
            
            const userId = verifyResponse.data.userId || verifyResponse.data.sub;
            const user = await User.findOne({ authId: userId });
            
            if (!user) {
              return res.status(401).json({ message: 'User not found in local database' });
            }
            
            // Set new access token in response header
            res.set('New-Access-Token', refreshResponse.data.accessToken);
            req.user = user;
            return next();
          }
        } catch (refreshErr) {
          console.error('Refresh token error:', refreshErr);
          return res.status(401).json({ message: 'Failed to refresh token' });
        }
      }
      throw accessErr;
    }  } catch (err) {
    console.error('Authentication error:', err.name, err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired - please refresh' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(401).json({ message: 'Authentication failed: ' + err.message });
  }
}
module.exports = authMiddleware;
