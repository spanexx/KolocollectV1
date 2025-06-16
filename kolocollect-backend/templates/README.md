# Email Templates System

This directory contains email templates for the KoloCollect application. The templates are organized by type and support both HTML and plain text formats.

## Directory Structure

```
templates/
└── emails/
    ├── welcome/
    │   ├── welcome.html     # Welcome email HTML template
    │   └── welcome.txt      # Welcome email text template
    ├── invitations/
    │   └── (future templates for invitations)
    └── password-reset/
        └── (future templates for password reset)
```

## Template Variables

Templates use `{{variableName}}` syntax for variable substitution. Common variables include:

### Welcome Email Variables

- `{{userName}}` - User's display name
- `{{userEmail}}` - User's email address
- `{{dashboardUrl}}` - Link to user dashboard
- `{{profileUrl}}` - Link to user profile
- `{{helpCenterUrl}}` - Link to help center
- `{{facebookUrl}}` - Facebook social link
- `{{twitterUrl}}` - Twitter social link
- `{{linkedinUrl}}` - LinkedIn social link
- `{{instagramUrl}}` - Instagram social link
- `{{currentYear}}` - Current year

## Usage

### Using Template Service

```javascript
const templateService = require('../services/templateService');

// Get welcome email templates
const templates = await templateService.getWelcomeEmailTemplates({
  name: 'John Doe',
  email: 'john@example.com'
});

// templates.html contains processed HTML
// templates.text contains processed text
```

### Using Email Service (Recommended)

```javascript
const emailService = require('../services/emailService');

// Send welcome email automatically
await emailService.sendWelcomeEmail({
  name: 'John Doe',
  email: 'john@example.com'
});
```

## Template Development

### Adding New Templates

1. Create a new directory under `templates/emails/`
2. Add both `.html` and `.txt` versions
3. Use `{{variableName}}` for dynamic content
4. Add method to `templateService.js` to load the template
5. Add method to `emailService.js` to send the email

### Template Validation

Use the template service to validate templates:

```javascript
const validation = await templateService.validateTemplate('welcome/welcome.html');
console.log('Valid:', validation.valid);
console.log('Issues:', validation.issues);
console.log('Placeholders:', validation.placeholders);
```

### Template Guidelines

1. **Responsive Design**: HTML templates should work on mobile devices
2. **Fallback Text**: Always provide a text version for email clients that don't support HTML
3. **Brand Consistency**: Use KoloCollect brand colors and styling
4. **Accessibility**: Use semantic HTML and good contrast ratios
5. **Testing**: Test templates in multiple email clients

## Template Styling

### Colors
- Primary Blue: `#007bff`
- Secondary Blue: `#0056b3`
- Success Green: `#28a745`
- Warning Yellow: `#ffc107`
- Danger Red: `#dc3545`

### Typography
- Font Family: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- Line Height: `1.6`
- Base Color: `#333`

### Layout
- Max Width: `600px`
- Container Padding: `20px`
- Border Radius: `10px`
- Box Shadow: `0 0 20px rgba(0,0,0,0.1)`

## Testing

Run the welcome email test:

```bash
node test-welcome-email.js
```

This will:
- Validate template syntax
- Test template processing
- Check email service configuration
- Optionally send test emails

## Environment Variables

The template service uses these environment variables:

- `FRONTEND_URL` - Base URL for frontend links (default: http://localhost:4200)
- Email service variables (for sending emails)

## Future Enhancements

Planned template types:
- [ ] Password reset emails
- [ ] Email verification
- [ ] Community invitation reminders
- [ ] Payout notifications
- [ ] Payment reminders
- [ ] Monthly statements
- [ ] Security alerts

## Troubleshooting

### Template Not Found
- Ensure file exists in correct directory
- Check file permissions
- Verify relative path

### Variables Not Replaced
- Check variable syntax: `{{variableName}}`
- Ensure variable is passed in data object
- Case-sensitive variable names

### Email Not Sending
- Check email service configuration
- Verify SMTP/provider settings
- Check logs for error messages

## Migration Notes

The existing email templates in the `emailService.js` can be gradually migrated to this template system for better maintainability and consistency.
