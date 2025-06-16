# Email Service Documentation

## Overview

The EmailService class provides a flexible, provider-agnostic email sending solution that supports multiple email providers through a unified interface.

## Supported Email Providers

### 1. SMTP (Default) - Gmail, Outlook, etc

**Status**: ✅ Fully Implemented

- Best for: Development, small-scale applications
- Limits: Gmail (500 emails/day), requires app passwords
- Cost: Free with Gmail account

### 2. SendGrid

**Status**: 🚧 Ready for Implementation

- Best for: Production applications
- Limits: 100 emails/day free tier
- Cost: $14.95/month for 40,000 emails

### 3. Mailgun

**Status**: 🚧 Ready for Implementation  

- Best for: Developers, API-first approach
- Limits: 5,000 emails/month free
- Cost: $35/month for 50,000 emails

### 4. AWS SES

**Status**: 🚧 Ready for Implementation

- Best for: AWS ecosystem, high volume
- Limits: 200 emails/day free tier
- Cost: $0.10 per 1,000 emails

## Configuration

### Environment Variables

```bash
# Email provider selection
EMAIL_PROVIDER=smtp  # Options: smtp, sendgrid, mailgun, aws-ses

# SMTP Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### Gmail Setup (Current Default)

1. Enable 2-Factor Authentication
2. Generate App Password:
   - Google Account → Security → App passwords
   - Select app: Mail
   - Copy the generated 16-character password
3. Update `.env`:
   ```bash
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

## Usage Examples

### Basic Email Sending

```javascript
const emailService = require('./services/emailService');

// Send invitation email
await emailService.sendInvitationEmail({
  to: 'user@example.com',
  communityName: 'Savings Circle',
  inviterName: 'John Doe',
  inviteCode: 'ABC123',
  customMessage: 'Join our savings group!',
  expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

// Generic email sending
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to Kolocollect',
  html: '<h1>Welcome!</h1>',
  text: 'Welcome!'
});
```

### Testing Configuration

```javascript
const isConfigured = await emailService.testEmailConfiguration();
console.log('Email configured:', isConfigured);

// Get provider info
const info = emailService.getProviderInfo();
console.log('Current provider:', info.provider);
```

## Switching Email Providers

### To SendGrid (Future)

1. Install dependency: `npm install @sendgrid/mail`
2. Get API key from SendGrid dashboard
3. Update environment:
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your-api-key
   ```

### To Mailgun (Future)  

1. Install dependency: `npm install mailgun.js`
2. Get API key and domain from Mailgun
3. Update environment:
4. 
   ```bash
   EMAIL_PROVIDER=mailgun
   MAILGUN_API_KEY=your-api-key
   MAILGUN_DOMAIN=your-domain.com
   ```

### To AWS SES (Future)

1. Configure AWS credentials
2. Update environment:
   ```bash
   EMAIL_PROVIDER=aws-ses
   AWS_REGION=us-east-1
   ```

## Email Templates

The service includes beautifully designed HTML email templates:

- Responsive design
- Brand colors and styling
- Professional appearance
- Fallback text versions

## Error Handling

The service provides comprehensive error handling:

- Provider-specific error messages
- Validation of required fields
- Graceful fallbacks
- Detailed logging

## Performance Considerations

- SMTP: Suitable for low-medium volume
- SendGrid/Mailgun: Better for high volume
- AWS SES: Most cost-effective for very high volume
- All providers support async operations

## Security Features

- Environment-based configuration
- Support for secure connections (TLS/SSL)
- API key management
- Input validation

## Migration Path

When ready to switch providers:

1. Install required dependencies
2. Update environment variables
3. No code changes required - the service handles provider switching automatically
4. Test with `testEmailConfiguration()`

The abstraction layer ensures zero code changes when switching providers!
