const rateLimit = require('express-rate-limit');

// Rate limiting for invitation creation
const invitationCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 invitation requests per windowMs
  message: {
    error: 'Too many invitation requests',
    message: 'You have exceeded the invitation limit. Please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use combination of IP and user ID for more precise limiting
    return `${req.ip}-${req.user?.id || 'anonymous'}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many invitation requests',
      message: 'You have exceeded the invitation limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting for invitation acceptance (public endpoint)
const invitationAcceptanceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 acceptance attempts per windowMs
  message: {
    error: 'Too many acceptance attempts',
    message: 'Please wait before trying to accept another invitation.',
    retryAfter: 5 * 60 // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many acceptance attempts',
      message: 'Please wait before trying to accept another invitation.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting for invitation listing (per user)
const invitationListingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 listing requests per minute
  message: {
    error: 'Too many requests',
    message: 'Please slow down your requests.',
    retryAfter: 60 // 1 minute in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `${req.ip}-${req.user?.id || 'anonymous'}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Please slow down your requests.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting for email resending
const invitationResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // limit each user to 3 resend attempts per 10 minutes
  message: {
    error: 'Too many resend attempts',
    message: 'Please wait before trying to resend invitations.',
    retryAfter: 10 * 60 // 10 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `resend-${req.ip}-${req.user?.id || 'anonymous'}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many resend attempts',
      message: 'Please wait before trying to resend invitations.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// General rate limiting for invitation-related endpoints
const generalInvitationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

module.exports = {
  invitationCreationLimiter,
  invitationAcceptanceLimiter,
  invitationListingLimiter,
  invitationResendLimiter,
  generalInvitationLimiter
};
