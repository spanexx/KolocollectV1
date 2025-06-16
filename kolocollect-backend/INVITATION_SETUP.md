# Environment Configuration for Invitation Feature

To enable the invitation functionality, add the following environment variables to your `.env` file:

## Email Configuration (Required for Email Invitations)

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Frontend URL (for invitation links)
FRONTEND_URL=http://localhost:4200
```

## Alternative Email Providers

### Gmail Setup
1. Enable 2-factor authentication
2. Generate an app password
3. Use the app password in SMTP_PASS

### SendGrid Setup
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=your-verified-sender@domain.com
```

### AWS SES Setup
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-access-key
SMTP_PASS=your-ses-secret-key
SMTP_FROM=your-verified-sender@domain.com
```

## Testing Email Configuration

You can test the email configuration using the API endpoint:
```bash
curl -X GET http://localhost:5000/api/invitations/test-email \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Features Enabled

With these configurations, the following invitation features will be available:

1. **Email Invitations**: Send professional invitation emails
2. **Link Invitations**: Generate shareable invitation links
3. **Invitation Management**: Admin dashboard for managing invitations
4. **Automatic Cleanup**: Daily cleanup of expired invitations
5. **Rate Limiting**: Protection against spam invitations
6. **Security**: Cryptographically secure invitation codes

## Database Requirements

The invitation feature will automatically create the necessary database indexes when the server starts. No manual database setup is required.

## Next Steps

1. Add the environment variables to your `.env` file
2. Restart the server
3. Test the invitation functionality through the API endpoints
4. Proceed to implement the frontend components
