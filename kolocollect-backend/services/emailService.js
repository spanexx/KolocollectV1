const nodemailer = require('nodemailer');
const { SESClient, SendEmailCommand, GetSendQuotaCommand } = require('@aws-sdk/client-ses');
require('dotenv').config();

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.fallbackOrder = this.parseFallbackOrder();
    this.retryAttempts = parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.EMAIL_RETRY_DELAY) || 2000;
    this.transporter = null;
    this.providerService = null;
    this.sesClient = null;
    this.availableProviders = new Map();
    this.initializeAllProviders();
  }

  /**
   * Parse fallback order from environment variable
   */
  parseFallbackOrder() {
    const fallbackStr = process.env.EMAIL_FALLBACK_ORDER || 'smtp,aws-ses,sendgrid';
    return fallbackStr.split(',').map(p => p.trim().toLowerCase());
  }

  /**
   * Initialize all available providers
   */
  initializeAllProviders() {
    // Initialize each provider and track which ones are available
    const providers = ['smtp', 'aws-ses', 'sendgrid', 'mailgun'];
    
    for (const provider of providers) {
      try {
        this.initializeSpecificProvider(provider);
        this.availableProviders.set(provider, true);
      } catch (error) {
        console.warn(`Provider ${provider} not available:`, error.message);
        this.availableProviders.set(provider, false);
      }
    }

    // Set primary provider
    if (this.provider === 'smart') {
      // Find first available provider from fallback order
      const availableProvider = this.fallbackOrder.find(p => this.availableProviders.get(p));
      this.provider = availableProvider || 'smtp';
    }

    console.log(`Email service initialized with primary provider: ${this.provider}`);
    console.log(`Available providers:`, Array.from(this.availableProviders.entries())
      .filter(([, available]) => available)
      .map(([provider]) => provider));
  }

  /**
   * Initialize a specific provider without setting it as primary
   */
  initializeSpecificProvider(provider) {
    switch (provider.toLowerCase()) {
      case 'sendgrid':
        this.initializeSendGrid();
        break;
      case 'mailgun':
        this.initializeMailgun();
        break;
      case 'aws-ses':
        this.initializeAWSSES();
        break;
      case 'smtp':
      default:
        this.initializeSMTP();
        break;
    }
  }

  /**
   * Initialize email provider based on configuration (legacy method)
   */
  initializeProvider() {
    this.initializeSpecificProvider(this.provider);
  }

  /**
   * Initialize SMTP provider (Gmail, etc.)
   */
  initializeSMTP() {
    // Check if we're running in Docker
    const isDocker = process.env.DOCKER_CONTAINER === 'true' || 
                     process.env.NODE_ENV === 'production' ||
                     process.cwd() === '/app';
    
    console.log(`🔧 Initializing SMTP provider (Docker environment: ${isDocker})`);

    // More lenient SSL settings for Docker
    const shouldRelaxSSL = isDocker || process.env.SMTP_REJECT_UNAUTHORIZED === 'false';
    
    if (shouldRelaxSSL) {
      console.log('🔒 Using relaxed SSL settings for Docker compatibility');
    }    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },      tls: {
        rejectUnauthorized: shouldRelaxSSL ? false : (process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'),
        // Additional settings for Docker environments
        ciphers: 'SSLv3',
        secureProtocol: 'TLSv1_2_method'
      }
    });
  }

  /**
   * Initialize SendGrid provider
   */
  initializeSendGrid() {
    // Will be implemented when needed
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is required for SendGrid provider');
    }
    
    // For now, set up for future implementation
    this.providerService = {
      type: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY
    };
  }

  /**
   * Initialize Mailgun provider
   */
  initializeMailgun() {
    // Will be implemented when needed
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN are required for Mailgun provider');
    }
    
    this.providerService = {
      type: 'mailgun',
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN
    };
  }

  /**
   * Initialize AWS SES provider
   */
  initializeAWSSES() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for AWS SES provider');
    }
    
    this.sesClient = new SESClient({
      region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    this.providerService = {
      type: 'aws-ses',
      region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1',
      fromEmail: process.env.SES_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
    };
  }  /**
   * Generic method to send email with smart fallback
   * @param {Object} emailOptions - Email options
   * @returns {Promise<Object>} - Email sending result
   */
  async sendEmail(emailOptions) {
    const { to, subject, text, html, from } = emailOptions;
    
    // Validate required fields
    if (!to) throw new Error('Email address is required');
    if (!subject) throw new Error('Email subject is required');
    if (!text && !html) throw new Error('Email content (text or html) is required');

    const fromAddress = from || this.getFromAddress();

    // If smart fallback is enabled, try providers in order
    if (process.env.EMAIL_PROVIDER === 'smart') {
      return await this.sendWithSmartFallback({ to, subject, text, html, from: fromAddress });
    }

    // Otherwise use the specified provider
    return await this.sendWithProvider(this.provider, { to, subject, text, html, from: fromAddress });
  }
  /**
   * Get appropriate from address based on provider
   */
  getFromAddress() {
    // Always use the properly configured FROM address
    const fromEmail = process.env.SES_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
    
    if (!fromEmail) {
      console.warn('⚠️ No FROM email configured. Check SES_FROM_EMAIL, SMTP_FROM, or SMTP_USER in environment');
      return 'noreply@kolocollect.com'; // fallback
    }
    
    return `"Kolocollect" <${fromEmail}>`;
  }

  /**
   * Send email with smart fallback - tries providers in order until one succeeds
   */
  async sendWithSmartFallback(emailOptions) {
    const errors = [];
    
    for (const provider of this.fallbackOrder) {
      if (!this.availableProviders.get(provider)) {
        console.warn(`Skipping unavailable provider: ${provider}`);
        continue;
      }

      console.log(`Attempting to send email with provider: ${provider}`);
      
      try {
        const result = await this.sendWithProvider(provider, emailOptions);
        console.log(`✅ Email sent successfully with provider: ${provider}`);
        return {
          ...result,
          provider: provider,
          fallbackUsed: provider !== this.fallbackOrder[0],
          attemptedProviders: errors.map(e => e.provider).concat([provider])
        };
      } catch (error) {
        console.warn(`❌ Provider ${provider} failed:`, error.message);
        errors.push({ provider, error: error.message });
        
        // Add delay before trying next provider
        if (this.retryDelay > 0) {
          await this.delay(this.retryDelay);
        }
      }
    }

    // All providers failed
    throw new Error(`All email providers failed. Errors: ${JSON.stringify(errors)}`);
  }

  /**
   * Send email with specific provider
   */
  async sendWithProvider(provider, emailOptions) {
    switch (provider.toLowerCase()) {
      case 'sendgrid':
        return await this.sendWithSendGrid(emailOptions);
      case 'mailgun':
        return await this.sendWithMailgun(emailOptions);
      case 'aws-ses':
        return await this.sendWithAWSSES(emailOptions);
      case 'smtp':
      default:
        return await this.sendWithSMTP(emailOptions);
    }
  }

  /**
   * Utility method to add delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send email via SMTP (current implementation)
   */
  async sendWithSMTP(emailOptions) {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized');
    }

    try {
      const result = await this.transporter.sendMail(emailOptions);
      return {
        success: true,
        messageId: result.messageId,
        provider: 'smtp',
        to: emailOptions.to
      };
    } catch (error) {
      console.error('SMTP send error:', error);
      throw new Error(`Failed to send email via SMTP: ${error.message}`);
    }
  }

  /**
   * Send email via SendGrid (placeholder for future implementation)
   */
  async sendWithSendGrid(emailOptions) {
    // TODO: Implement SendGrid when needed
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(this.providerService.apiKey);
    // const msg = { ...emailOptions };
    // const result = await sgMail.send(msg);
    
    throw new Error('SendGrid provider not yet implemented. Please set EMAIL_PROVIDER=smtp');
  }

  /**
   * Send email via Mailgun (placeholder for future implementation)
   */
  async sendWithMailgun(emailOptions) {
    // TODO: Implement Mailgun when needed
    throw new Error('Mailgun provider not yet implemented. Please set EMAIL_PROVIDER=smtp');
  }  /**
   * Send email via AWS SES
   */
  async sendWithAWSSES(emailOptions) {
    if (!this.sesClient) {
      throw new Error('AWS SES client not initialized');
    }

    const { to, subject, text, html, from } = emailOptions;
    
    // Ensure we use the correct FROM address
    const fromAddress = from || this.providerService.fromEmail || process.env.SES_FROM_EMAIL;
    
    console.log(`🔧 AWS SES Debug - FROM: ${fromAddress}, TO: ${to}`);
    
    // Prepare the email parameters for SES
    const params = {
      Source: fromAddress,
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {}
      }
    };

    // Add text content if provided
    if (text) {
      params.Message.Body.Text = {
        Data: text,
        Charset: 'UTF-8'
      };
    }

    // Add HTML content if provided
    if (html) {
      params.Message.Body.Html = {
        Data: html,
        Charset: 'UTF-8'
      };
    }

    try {
      const command = new SendEmailCommand(params);
      const result = await this.sesClient.send(command);
      
      return {
        success: true,
        messageId: result.MessageId,
        provider: 'aws-ses',
        to: emailOptions.to,
        sesResponse: result
      };
    } catch (error) {
      console.error('AWS SES send error:', error);
      
      // Handle specific SES errors
      if (error.name === 'MessageRejected') {
        throw new Error(`Email rejected by AWS SES: ${error.message}`);
      } else if (error.name === 'MailFromDomainNotVerified') {
        throw new Error(`Domain not verified in AWS SES: ${error.message}`);
      } else if (error.name === 'ConfigurationSetDoesNotExist') {
        throw new Error(`AWS SES configuration error: ${error.message}`);
      }
      
      throw new Error(`Failed to send email via AWS SES: ${error.message}`);
    }
  }

  /**
   * Generate HTML template for invitation email
   * @param {Object} data - Email template data
   * @returns {string} - HTML content
   */
  generateInvitationEmailHTML(data) {
    const { 
      communityName, 
      inviterName, 
      inviteLink, 
      customMessage, 
      expirationDate 
    } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to Join ${communityName}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header { 
            text-align: center; 
            padding: 20px 0; 
            border-bottom: 2px solid #007bff;
            margin-bottom: 30px;
          }
          .header h1 { 
            color: #007bff; 
            margin: 0;
            font-size: 28px;
          }
          .invitation-card {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
          }
          .community-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .inviter-info {
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 20px;
          }
          .cta-button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #28a745; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            transition: background-color 0.3s;
          }
          .cta-button:hover {
            background-color: #218838;
          }
          .custom-message {
            background-color: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #007bff;
            margin: 20px 0;
            border-radius: 5px;
          }
          .expiration-info {
            text-align: center;
            color: #dc3545;
            font-weight: bold;
            margin: 20px 0;
            padding: 15px;
            background-color: #fff5f5;
            border-radius: 5px;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            color: #666;
            font-size: 14px;
          }
          .logo {
            max-width: 150px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Invited!</h1>
          </div>
          
          <div class="invitation-card">
            <div class="community-name">${communityName}</div>
            <div class="inviter-info">
              ${inviterName} has invited you to join this community
            </div>
          </div>

          ${customMessage ? `
            <div class="custom-message">
              <h3>Personal Message:</h3>
              <p>${customMessage}</p>
            </div>
          ` : ''}

          <div style="text-align: center;">
            <a href="${inviteLink}" class="cta-button">
              Accept Invitation
            </a>
          </div>

          <div class="expiration-info">
            ⏰ This invitation expires on ${new Date(expirationDate).toLocaleDateString()}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p>What is Kolocollect?</p>
            <p style="color: #666; font-size: 14px;">
              Kolocollect is a community-based savings platform that helps people 
              save money together through rotating credit associations (ROSCAs). 
              Join communities, contribute regularly, and receive payouts when it's your turn!
            </p>
          </div>

          <div class="footer">
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${inviteLink}" style="color: #007bff;">${inviteLink}</a></p>
            <hr style="margin: 20px 0;">
            <p>© 2025 Kolocollect. All rights reserved.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text version of invitation email
   * @param {Object} data - Email template data
   * @returns {string} - Plain text content
   */
  generateInvitationEmailText(data) {
    const { 
      communityName, 
      inviterName, 
      inviteLink, 
      customMessage, 
      expirationDate 
    } = data;

    return `
You're Invited to Join ${communityName}!

${inviterName} has invited you to join the "${communityName}" community on Kolocollect.

${customMessage ? `Personal Message:\n${customMessage}\n\n` : ''}

To accept this invitation, click the link below or copy and paste it into your browser:
${inviteLink}

This invitation expires on ${new Date(expirationDate).toLocaleDateString()}.

What is Kolocollect?
Kolocollect is a community-based savings platform that helps people save money together through rotating credit associations (ROSCAs). Join communities, contribute regularly, and receive payouts when it's your turn!

© 2025 Kolocollect. All rights reserved.
If you didn't expect this invitation, you can safely ignore this email.
    `.trim();
  }
  /**
   * Send invitation email
   * @param {string|Object} to - Email address or invitation data object
   * @param {string} inviteLink - Invitation link (if first param is string)
   * @param {string} communityName - Community name (if first param is string)
   * @param {string} inviterName - Inviter name (if first param is string)
   * @param {string} customMessage - Custom message (if first param is string)
   * @param {Date} expirationDate - Expiration date (if first param is string)
   * @returns {Promise<Object>} - Email sending result
   */
  async sendInvitationEmail(to, inviteLink, communityName, inviterName, customMessage, expirationDate) {
    // Handle both old and new calling patterns
    let emailData;
    
    if (typeof to === 'object' && to !== null) {
      // New pattern: single object parameter
      emailData = {
        to: to.to,
        communityName: to.communityName,
        inviterName: to.inviterName,
        inviteCode: to.inviteCode,
        customMessage: to.customMessage,
        expirationDate: to.expirationDate
      };
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      emailData.inviteLink = `${frontendUrl}/invite/${emailData.inviteCode}`;
    } else {
      // Old pattern: separate parameters
      emailData = {
        to: to,
        inviteLink: inviteLink,
        communityName: communityName,
        inviterName: inviterName,
        customMessage: customMessage,
        expirationDate: expirationDate
      };
    }

    // Validate required fields
    if (!emailData.to) {
      throw new Error('Email address is required');
    }
    if (!emailData.communityName) {
      throw new Error('Community name is required');
    }
    if (!emailData.inviterName) {
      throw new Error('Inviter name is required');
    }
    if (!emailData.inviteLink) {
      throw new Error('Invite link is required');
    }    if (!this.transporter && this.provider === 'smtp') {
      throw new Error('Email transporter not initialized');
    }

    const mailData = {
      communityName: emailData.communityName,
      inviterName: emailData.inviterName,
      inviteLink: emailData.inviteLink,
      customMessage: emailData.customMessage,
      expirationDate: emailData.expirationDate
    };

    const emailOptions = {
      to: emailData.to,
      subject: `You're invited to join ${emailData.communityName} on Kolocollect`,
      text: this.generateInvitationEmailText(mailData),
      html: this.generateInvitationEmailHTML(mailData)
    };

    try {
      const result = await this.sendEmail(emailOptions);
      console.log('Invitation email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw new Error(`Failed to send invitation email: ${error.message}`);
    }
  }
  /**
   * Send invitation reminder email
   * @param {Object} invitationData - Invitation data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendInvitationReminder(invitationData) {
    // Similar to sendInvitationEmail but with reminder-specific content
    const emailData = { ...invitationData };
    emailData.isReminder = true;
    
    // Modify content for reminder
    const emailOptions = {
      to: invitationData.to,
      subject: `Reminder: Your invitation to ${invitationData.communityName} expires soon`,
      text: this.generateInvitationEmailText({
        ...emailData,
        customMessage: `This is a friendly reminder that your invitation expires on ${new Date(invitationData.expirationDate).toLocaleDateString()}.\n\n${invitationData.customMessage || ''}`
      }),
      html: this.generateInvitationEmailHTML({
        ...emailData,
        customMessage: `This is a friendly reminder that your invitation expires on ${new Date(invitationData.expirationDate).toLocaleDateString()}.<br><br>${invitationData.customMessage || ''}`
      })
    };

    try {
      const result = await this.sendEmail(emailOptions);
      return result;
    } catch (error) {
      console.error('Error sending reminder email:', error);
      throw new Error(`Failed to send reminder email: ${error.message}`);
    }
  }  /**
   * Send welcome email to new users
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendWelcomeEmail(userData) {
    const { name, email } = userData;
    
    if (!name || !email) {
      throw new Error('User name and email are required for welcome email');
    }

    const emailOptions = {
      to: email,
      subject: 'Welcome to Kolocollect! 🎉',
      text: this.generateWelcomeEmailText({ name }),
      html: this.generateWelcomeEmailHTML({ name })
    };

    try {
      const result = await this.sendEmail(emailOptions);
      console.log(`Welcome email sent to ${email}:`, result.messageId || result.success);
      return result;
    } catch (error) {
      console.error(`Error sending welcome email to ${email}:`, error);
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }
  }

  /**
   * Generate HTML template for welcome email
   * @param {Object} data - Email template data
   * @returns {string} - HTML content
   */
  generateWelcomeEmailHTML(data) {
    const { name } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Kolocollect</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header { 
            text-align: center; 
            padding: 20px 0; 
            border-bottom: 2px solid #007bff;
            margin-bottom: 30px;
          }
          .header h1 { 
            color: #007bff; 
            margin: 0;
            font-size: 28px;
          }
          .welcome-card {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
          }
          .welcome-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .cta-button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #28a745; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            transition: background-color 0.3s;
          }
          .cta-button:hover {
            background-color: #218838;
          }
          .feature-box {
            background-color: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #007bff;
            margin: 20px 0;
            border-radius: 5px;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Kolocollect!</h1>
          </div>
          
          <div class="welcome-card">
            <div class="welcome-title">Hi ${name}!</div>
            <p>Thank you for joining Kolocollect - your journey to better savings starts now!</p>
          </div>

          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:4200'}" class="cta-button">
              Start Saving Today
            </a>
          </div>

          <div class="feature-box">
            <h3>🏦 What you can do with Kolocollect:</h3>
            <ul style="text-align: left;">
              <li><strong>Join Communities:</strong> Connect with like-minded savers</li>
              <li><strong>Regular Contributions:</strong> Save consistently with your group</li>
              <li><strong>Receive Payouts:</strong> Get your turn when the time comes</li>
              <li><strong>Track Progress:</strong> Monitor your savings journey</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p><strong>Ready to get started?</strong></p>
            <p style="color: #666; font-size: 14px;">
              Kolocollect is a community-based savings platform that helps people 
              save money together through rotating credit associations (ROSCAs). 
              Build your financial future with the support of your community!
            </p>
          </div>

          <div class="footer">
            <p>Need help? Visit our support center or reply to this email.</p>
            <hr style="margin: 20px 0;">
            <p>© 2025 Kolocollect. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text version of welcome email
   * @param {Object} data - Email template data
   * @returns {string} - Plain text content
   */
  generateWelcomeEmailText(data) {
    const { name } = data;

    return `
Welcome to Kolocollect! 🎉

Hi ${name}!

Thank you for joining Kolocollect - your journey to better savings starts now!

What you can do with Kolocollect:
• Join Communities: Connect with like-minded savers
• Regular Contributions: Save consistently with your group  
• Receive Payouts: Get your turn when the time comes
• Track Progress: Monitor your savings journey

Ready to get started? Visit: ${process.env.CLIENT_URL || 'http://localhost:4200'}

Kolocollect is a community-based savings platform that helps people save money together through rotating credit associations (ROSCAs). Build your financial future with the support of your community!

Need help? Visit our support center or reply to this email.

© 2025 Kolocollect. All rights reserved.
    `.trim();
  }
  /**
   * Test email configuration
   * @returns {Promise<boolean>} - Whether email configuration is working
   */
  async testEmailConfiguration() {
    try {
      switch (this.provider.toLowerCase()) {
        case 'smtp':
          if (!this.transporter) {
            throw new Error('SMTP transporter not initialized');
          }
          await this.transporter.verify();
          console.log(`Email server configuration is valid (Provider: ${this.provider})`);
          break;        case 'aws-ses':
          if (!this.sesClient) {
            throw new Error('AWS SES client not initialized');
          }
          // Test SES by checking if we can access the service
          const quotaCommand = new GetSendQuotaCommand({});
          const quotaResult = await this.sesClient.send(quotaCommand);
          console.log(`AWS SES configuration is valid (Provider: ${this.provider})`);
          console.log(`SES Quota - Max24HourSend: ${quotaResult.Max24HourSend}, SentLast24Hours: ${quotaResult.SentLast24Hours}`);
          break;
        case 'sendgrid':
        case 'mailgun':
          // For API-based providers, we could send a test email or validate API keys
          console.log(`Email provider ${this.provider} configured (validation not implemented)`);
          break;
        default:
          throw new Error(`Unknown email provider: ${this.provider}`);
      }
      return true;
    } catch (error) {
      console.error('Email server configuration error:', error);
      return false;
    }
  }  /**
   * Get current email provider information
   * @returns {Object} - Provider information
   */
  getProviderInfo() {
    const isInitialized = this.provider === 'smtp' ? 
      !!this.transporter : 
      this.provider === 'aws-ses' ? 
        !!this.sesClient : 
        !!this.providerService;

    const availableProviders = Array.from(this.availableProviders.entries())
      .filter(([, available]) => available)
      .map(([provider]) => provider);

    return {
      provider: this.provider,
      isInitialized: isInitialized,
      isSmartFallback: process.env.EMAIL_PROVIDER === 'smart',
      fallbackOrder: this.fallbackOrder,
      supportedProviders: ['smtp', 'sendgrid', 'mailgun', 'aws-ses', 'smart'],
      availableProviders: availableProviders,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay,
      currentConfig: this.provider === 'aws-ses' ? {
        region: this.providerService?.region,
        fromEmail: this.providerService?.fromEmail
      } : null
    };
  }
  /**
   * Send community created email to admin
   * @param {Object} communityData - Community data
   * @param {Object} adminData - Admin user data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendCommunityCreatedEmail(communityData, adminData) {
    const { _id, name, description, settings, createdAt } = communityData;
    const { name: adminName, email: adminEmail } = adminData;
    
    if (!name || !adminEmail || !adminName) {
      throw new Error('Community name, admin name and email are required for community created email');
    }

    const templateData = {
      communityName: name,
      description: description || '',
      maxMembers: settings?.maxMembers || 'Not set',
      contributionFrequency: settings?.contributionFrequency || 'Not set',
      createdDate: createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      adminName,
      adminEmail,
      communityUrl: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/communities/${_id}`,
      communityId: _id
    };

    const emailOptions = {
      to: adminEmail,
      subject: `🎉 Your Community "${name}" has been Created Successfully!`,
      text: this.generateCommunityCreatedEmailText(templateData),
      html: await this.loadEmailTemplate('community/community-created.html', templateData)
    };

    try {
      const result = await this.sendEmail(emailOptions);
      console.log(`Community created email sent to ${adminEmail}:`, result.messageId || result.success);
      return result;
    } catch (error) {
      console.error(`Error sending community created email to ${adminEmail}:`, error);
      throw new Error(`Failed to send community created email: ${error.message}`);
    }
  }

  /**
   * Send community joined email to new member
   * @param {Object} communityData - Community data
   * @param {Object} memberData - New member data
   * @param {Object} joinContext - Context about the join (mid-cycle, etc.)
   * @returns {Promise<Object>} - Email sending result
   */
  async sendCommunityJoinedEmail(communityData, memberData, joinContext = {}) {
    const { _id, name, description, settings, admin } = communityData;
    const { name: memberName, email: memberEmail, position } = memberData;
    const { isMidCycle = false, adminName = 'Community Admin' } = joinContext;
    
    if (!name || !memberEmail || !memberName) {
      throw new Error('Community name, member name and email are required for community joined email');
    }

    const memberStatus = isMidCycle ? 'waiting' : 'active';
    const memberStatusText = isMidCycle ? 'Pending (Mid-cycle join)' : 'Active';

    const templateData = {
      communityName: name,
      description: description || '',
      memberName,
      memberEmail,
      memberPosition: position || null,
      memberStatus,
      memberStatusText,
      contributionFrequency: settings?.contributionFrequency || 'Not set',
      joinedDate: new Date().toLocaleDateString(),
      adminName,
      isMidCycle,
      communityUrl: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/communities/${_id}`,
      communityId: _id
    };

    const emailOptions = {
      to: memberEmail,
      subject: `🎉 Welcome to "${name}" Community!`,
      text: this.generateCommunityJoinedEmailText(templateData),
      html: await this.loadEmailTemplate('community/community-joined.html', templateData)
    };

    try {
      const result = await this.sendEmail(emailOptions);
      console.log(`Community joined email sent to ${memberEmail}:`, result.messageId || result.success);
      return result;
    } catch (error) {
      console.error(`Error sending community joined email to ${memberEmail}:`, error);
      throw new Error(`Failed to send community joined email: ${error.message}`);
    }
  }

  /**
   * Generate text version for community created email
   * @param {Object} data - Template data
   * @returns {string} - Text content
   */
  generateCommunityCreatedEmailText(data) {
    const { communityName, adminName, maxMembers, contributionFrequency, createdDate } = data;
    
    return `
🎉 Congratulations ${adminName}!

Your community "${communityName}" has been successfully created on ${createdDate}.

Community Details:
- Name: ${communityName}
- Max Members: ${maxMembers}
- Contribution Frequency: ${contributionFrequency}
- Admin: ${adminName}

What's Next?
✓ Invite Members: Share your community with friends and family
✓ Set Up Contributions: Configure contribution amounts and schedules  
✓ Start Your First Cycle: Begin saving together as a group
✓ Monitor Progress: Track member contributions and payouts

Manage your community: ${data.communityUrl}

Need help? Visit our support center or reply to this email.

Best regards,
The Kolocollect Team

© 2025 Kolocollect. All rights reserved.
    `.trim();
  }

  /**
   * Generate text version for community joined email
   * @param {Object} data - Template data
   * @returns {string} - Text content
   */
  generateCommunityJoinedEmailText(data) {
    const { communityName, memberName, memberStatusText, contributionFrequency, joinedDate, adminName, isMidCycle } = data;
    
    return `
🎉 Welcome ${memberName}!

You've successfully joined the "${communityName}" community on ${joinedDate}.

Your Status: ${memberStatusText}

Community Information:
- Community: ${communityName}
- Contribution Frequency: ${contributionFrequency}
- Community Admin: ${adminName}
- Your Position: ${data.memberPosition || 'To be assigned'}

What Happens Next?
${isMidCycle ? 
  `✓ Mid-Cycle Join: You've joined during an active cycle
✓ Catch-Up Contributions: You may need to make back-payments
✓ Next Payout: You'll be eligible for payouts in the next cycle` :
  `✓ Wait for More Members: The community needs more members to start
✓ First Contribution: You'll be notified when it's time to contribute
✓ Payout Schedule: Learn about when you'll receive your payout`
}
✓ Stay Active: Participate in community discussions and votes

View your community: ${data.communityUrl}

Kolocollect communities work through rotating credit associations (ROSCAs). 
Members contribute regularly, and each member receives a payout when it's their turn. 
This system helps everyone save consistently while getting access to larger sums when needed.

Questions? Contact the admin or visit our support center.

Best regards,
The Kolocollect Team

© 2025 Kolocollect. All rights reserved.
    `.trim();
  }
  /**
   * Send password reset email with link and verification code
   */
  async sendPasswordResetEmail(data) {
    try {
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('auth/password-reset-request.html', {
        userName: data.userName,
        resetUrl: data.resetUrl,
        verificationCode: data.verificationCode,
        expirationTime: data.expirationTime,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('auth/password-reset-request.txt', {
        userName: data.userName,
        resetUrl: data.resetUrl,
        verificationCode: data.verificationCode,
        expirationTime: data.expirationTime,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.email,
        subject: '🔐 Reset Your KoloCollect Password',
        html: htmlContent,
        text: textContent,
        type: 'auth'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Password reset email sent successfully:', { email: data.email });
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }

  /**
   * Send upcoming payout reminder email
   * @param {Object} data - Payout reminder data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendUpcomingPayoutReminder(data) {
    try {
      // Format the payout date
      const payoutDate = new Date(data.payoutDate);
      const formattedDate = payoutDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Extract recipient name from email
      const recipientName = data.recipientEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('financial/upcoming-payout-reminder.html', {
        userName: recipientName,
        communityName: data.communityName,
        payoutDate: formattedDate,
        expectedAmount: parseFloat(data.expectedAmount).toFixed(2),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('financial/upcoming-payout-reminder.txt', {
        userName: recipientName,
        communityName: data.communityName,
        payoutDate: formattedDate,
        expectedAmount: parseFloat(data.expectedAmount).toFixed(2),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.recipientEmail,
        subject: `🔔 Upcoming Payout Reminder - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'financial'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Upcoming payout reminder email sent successfully:', { email: data.recipientEmail });
      return result;
    } catch (error) {
      console.error('Error sending upcoming payout reminder email:', error);
      throw new Error(`Failed to send upcoming payout reminder email: ${error.message}`);
    }
  }

  /**
   * Send payout notification email
   * @param {Object} data - Payout data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendPayoutNotification(data) {
    try {
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('financial/payout-received.html', {
        userName: data.recipient.split('@')[0],
        amount: data.amount.toFixed(2),
        communityName: data.communityName,
        cycleNumber: data.cycleNumber,
        payoutDate: new Date(data.payoutDate).toLocaleString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('financial/payout-received.txt', {
        userName: data.recipient.split('@')[0],
        amount: data.amount.toFixed(2),
        communityName: data.communityName,
        cycleNumber: data.cycleNumber,
        payoutDate: new Date(data.payoutDate).toLocaleString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.recipient,
        subject: `💰 Your Payout of €${data.amount.toFixed(2)} from ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'financial'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Payout notification email sent successfully:', { email: data.recipient });
      return result;
    } catch (error) {
      console.error('Error sending payout notification email:', error);
      throw new Error(`Failed to send payout notification email: ${error.message}`);
    }
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmationEmail(data) {
    try {
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('auth/password-reset-confirmation.html', {
        userName: data.userName,
        resetTime: data.resetTime,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('auth/password-reset-confirmation.txt', {
        userName: data.userName,
        resetTime: data.resetTime,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.email,
        subject: '✅ Password Reset Successful - KoloCollect',
        html: htmlContent,
        text: textContent,
        type: 'auth'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Password reset confirmation email sent successfully:', { email: data.email });
      return result;
    } catch (error) {
      console.error('Error sending password reset confirmation email:', error);
      throw new Error(`Failed to send password reset confirmation email: ${error.message}`);
    }
  }

  /**
   * Send missed contribution alert email
   * @param {Object} data - Missed contribution data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendMissedContributionAlert(data) {
    try {
      // Extract recipient name from email
      const recipientName = data.memberEmail.split('@')[0];
      
      // Determine severity based on missed count vs threshold
      const severity = data.thresholdWarning ? 'high' : 'medium';
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('contributions/missed-contribution-alert.html', {
        userName: recipientName,
        communityName: data.communityName,
        penaltyAmount: parseFloat(data.penaltyAmount).toFixed(2),
        missedCount: data.missedCount,
        thresholdWarning: data.thresholdWarning,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
        severity: severity
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('contributions/missed-contribution-alert.txt', {
        userName: recipientName,
        communityName: data.communityName,
        penaltyAmount: parseFloat(data.penaltyAmount).toFixed(2),
        missedCount: data.missedCount,
        thresholdWarning: data.thresholdWarning,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
        severity: severity
      });

      const emailOptions = {
        to: data.memberEmail,
        subject: data.thresholdWarning ? 
          `⚠️ URGENT: Missed Contribution in ${data.communityName} - Action Required` :
          `⚠️ Missed Contribution in ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'contributions'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Missed contribution alert email sent successfully:', { email: data.memberEmail });
      return result;
    } catch (error) {
      console.error('Error sending missed contribution alert email:', error);
      throw new Error(`Failed to send missed contribution alert email: ${error.message}`);
    }
  }

  /**
   * Send contribution confirmation email
   * @param {Object} data - Contribution data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendContributionConfirmation(data) {
    try {
      // Extract recipient name from email
      const recipientName = data.memberEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('contributions/contribution-confirmation.html', {
        userName: recipientName,
        amount: parseFloat(data.amount).toFixed(2),
        communityName: data.communityName,
        cycleNumber: data.cycleNumber,
        transactionId: data.transactionId || 'N/A',
        contributionDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('contributions/contribution-confirmation.txt', {
        userName: recipientName,
        amount: parseFloat(data.amount).toFixed(2),
        communityName: data.communityName,
        cycleNumber: data.cycleNumber,
        transactionId: data.transactionId || 'N/A',
        contributionDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.memberEmail,
        subject: `✅ Contribution Confirmed - €${parseFloat(data.amount).toFixed(2)} to ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'contributions'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Contribution confirmation email sent successfully:', { email: data.memberEmail });
      return result;
    } catch (error) {
      console.error('Error sending contribution confirmation email:', error);
      throw new Error(`Failed to send contribution confirmation email: ${error.message}`);
    }
  }

  /**
   * Send contribution deadline reminder email
   * @param {Object} data - Reminder data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendContributionReminder(data) {
    try {
      // Extract recipient name from email
      const recipientName = data.memberEmail.split('@')[0];
      
      // Format deadline date
      const deadlineDate = new Date(data.deadlineDate);
      const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('contributions/contribution-reminder.html', {
        userName: recipientName,
        communityName: data.communityName,
        deadlineDate: formattedDeadline,
        minContribution: parseFloat(data.minContribution).toFixed(2),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('contributions/contribution-reminder.txt', {
        userName: recipientName,
        communityName: data.communityName,
        deadlineDate: formattedDeadline,
        minContribution: parseFloat(data.minContribution).toFixed(2),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.memberEmail,
        subject: `⏰ Reminder: Contribution Due Soon - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'contributions'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Contribution reminder email sent successfully:', { email: data.memberEmail });
      return result;
    } catch (error) {
      console.error('Error sending contribution reminder email:', error);
      throw new Error(`Failed to send contribution reminder email: ${error.message}`);
    }
  }

  /**
   * Send penalty notification email
   * @param {Object} data - Penalty data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendPenaltyNotification(data) {
    try {
      // Extract recipient name from email
      const recipientName = data.memberEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('penalties/penalty-applied.html', {
        userName: recipientName,
        deductedAmount: parseFloat(data.deductedAmount).toFixed(2),
        remainingPenalty: parseFloat(data.remainingPenalty).toFixed(2),
        communityName: data.communityName,
        missedContributions: data.missedContributions,
        penaltyDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('penalties/penalty-applied.txt', {
        userName: recipientName,
        deductedAmount: parseFloat(data.deductedAmount).toFixed(2),
        remainingPenalty: parseFloat(data.remainingPenalty).toFixed(2),
        communityName: data.communityName,
        missedContributions: data.missedContributions,
        penaltyDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.memberEmail,
        subject: `⚠️ Penalty Applied - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'penalties'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Penalty notification email sent successfully:', { email: data.memberEmail });
      return result;
    } catch (error) {
      console.error('Error sending penalty notification email:', error);
      throw new Error(`Failed to send penalty notification email: ${error.message}`);
    }
  }

  /**
   * Send wallet freeze notification email
   * @param {Object} data - Wallet freeze data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendWalletFreezeNotification(data) {
    try {
      // Extract recipient name from email
      const recipientName = data.memberEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('penalties/wallet-frozen.html', {
        userName: recipientName,
        communityName: data.communityName,
        frozenBalance: parseFloat(data.frozenBalance).toFixed(2),
        reason: data.reason,
        actionRequired: data.actionRequired,
        freezeDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('penalties/wallet-frozen.txt', {
        userName: recipientName,
        communityName: data.communityName,
        frozenBalance: parseFloat(data.frozenBalance).toFixed(2),
        reason: data.reason,
        actionRequired: data.actionRequired,
        freezeDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.memberEmail,
        subject: `🔒 Wallet Frozen - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'penalties'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Wallet freeze notification email sent successfully:', { email: data.memberEmail });
      return result;
    } catch (error) {
      console.error('Error sending wallet freeze notification email:', error);
      throw new Error(`Failed to send wallet freeze notification email: ${error.message}`);
    }
  }

  /**
   * Send member status change notification email
   * @param {Object} data - Status change data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendMemberStatusChangeNotification(data) {
    try {
      // Extract recipient name from email
      const recipientName = data.memberEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('penalties/status-change-inactive.html', {
        userName: recipientName,
        communityName: data.communityName,
        newStatus: data.newStatus,
        reason: data.reason,
        missedCount: data.missedCount,
        statusChangeDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('penalties/status-change-inactive.txt', {
        userName: recipientName,
        communityName: data.communityName,
        newStatus: data.newStatus,
        reason: data.reason,
        missedCount: data.missedCount,
        statusChangeDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.memberEmail,
        subject: `📢 Status Update - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'penalties'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Member status change notification email sent successfully:', { email: data.memberEmail });
      return result;
    } catch (error) {
      console.error('Error sending member status change notification email:', error);
      throw new Error(`Failed to send member status change notification email: ${error.message}`);
    }
  }

  /**
   * Send payout failure alert email to admin
   * @param {Object} data - Payout failure data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendPayoutFailureAlert(data) {
    try {
      // Extract admin name from email
      const adminName = data.adminEmail.split('@')[0];
      
      // Format scheduled date
      const scheduledDate = new Date(data.scheduledDate);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('financial/payout-failure-admin.html', {
        adminName: adminName,
        communityName: data.communityName,
        nextInLine: data.nextInLine,
        scheduledDate: formattedDate,
        failureReason: data.failureReason || 'Insufficient contributions or system error',
        alertTime: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('financial/payout-failure-admin.txt', {
        adminName: adminName,
        communityName: data.communityName,
        nextInLine: data.nextInLine,
        scheduledDate: formattedDate,
        failureReason: data.failureReason || 'Insufficient contributions or system error',
        alertTime: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.adminEmail,
        subject: `🚨 URGENT: Payout Failure Alert - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'financial'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Payout failure alert email sent successfully:', { email: data.adminEmail });
      return result;
    } catch (error) {
      console.error('Error sending payout failure alert email:', error);
      throw new Error(`Failed to send payout failure alert email: ${error.message}`);
    }
  }

  /**
   * Send new member notification to admin
   * @param {Object} data - New member data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendNewMemberNotificationToAdmin(data) {
    try {
      // Extract admin name from email
      const adminName = data.adminEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('admin/new-member-joined.html', {
        adminName: adminName,
        newMemberName: data.newMemberName,
        newMemberEmail: data.newMemberEmail,
        communityName: data.communityName,
        joinDate: new Date(data.joinDate).toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('admin/new-member-joined.txt', {
        adminName: adminName,
        newMemberName: data.newMemberName,
        newMemberEmail: data.newMemberEmail,
        communityName: data.communityName,
        joinDate: new Date(data.joinDate).toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.adminEmail,
        subject: `👋 New Member Joined - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'admin'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('New member notification email sent to admin successfully:', { email: data.adminEmail });
      return result;
    } catch (error) {
      console.error('Error sending new member notification email:', error);
      throw new Error(`Failed to send new member notification email: ${error.message}`);
    }
  }

  /**
   * Send member leave notification to admin
   * @param {Object} data - Member leave data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendMemberLeaveNotification(data) {
    try {
      // Extract admin name from email
      const adminName = data.adminEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('admin/member-left.html', {
        adminName: adminName,
        memberName: data.memberName,
        communityName: data.communityName,
        leaveDate: new Date(data.leaveDate).toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('admin/member-left.txt', {
        adminName: adminName,
        memberName: data.memberName,
        communityName: data.communityName,
        leaveDate: new Date(data.leaveDate).toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.adminEmail,
        subject: `👋 Member Left - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'admin'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Member leave notification email sent to admin successfully:', { email: data.adminEmail });
      return result;
    } catch (error) {
      console.error('Error sending member leave notification email:', error);
      throw new Error(`Failed to send member leave notification email: ${error.message}`);
    }
  }

  /**
   * Send cycle completion notification to admin
   * @param {Object} data - Cycle completion data
   * @returns {Promise<Object>} - Email sending result
   */
  async sendCycleCompletionNotification(data) {
    try {
      // Extract admin name from email
      const adminName = data.adminEmail.split('@')[0];
      
      // Load HTML template
      const htmlContent = await this.loadEmailTemplate('admin/cycle-completed.html', {
        adminName: adminName,
        communityName: data.communityName,
        completedCycleNumber: data.completedCycleNumber,
        totalDistributed: parseFloat(data.totalDistributed).toFixed(2),
        newCycleStart: data.newCycleStart,
        completionDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      // Load text template
      const textContent = await this.loadEmailTemplate('admin/cycle-completed.txt', {
        adminName: adminName,
        communityName: data.communityName,
        completedCycleNumber: data.completedCycleNumber,
        totalDistributed: parseFloat(data.totalDistributed).toFixed(2),
        newCycleStart: data.newCycleStart,
        completionDate: new Date().toLocaleDateString(),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200'
      });

      const emailOptions = {
        to: data.adminEmail,
        subject: `🎉 Cycle Completed - ${data.communityName}`,
        html: htmlContent,
        text: textContent,
        type: 'admin'
      };

      const result = await this.sendEmail(emailOptions);
      console.log('Cycle completion notification email sent to admin successfully:', { email: data.adminEmail });
      return result;
    } catch (error) {
      console.error('Error sending cycle completion notification email:', error);
      throw new Error(`Failed to send cycle completion notification email: ${error.message}`);
    }
  }

  /**
   * Load email template from file system
   * @param {string} templatePath - Path to the email template file
   * @param {Object} data - Data to populate the template
   * @returns {Promise<string>} - Rendered HTML content
   */
  async loadEmailTemplate(templatePath, data) {
    const fs = require('fs').promises;
    const path = require('path');
    const Handlebars = require('handlebars');

    try {
      // Resolve the full path to the template file
      const filePath = path.resolve(__dirname, '../templates/emails', templatePath);
      
      // Read the file content
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Compile the template with Handlebars
      const template = Handlebars.compile(fileContent);
      const renderedContent = template(data);
      
      return renderedContent;
    } catch (error) {
      console.error('Error loading email template:', error);
      throw new Error(`Failed to load email template: ${error.message}`);
    }
  }
}

module.exports = new EmailService();
