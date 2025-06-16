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
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
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
    if (process.env.SES_FROM_EMAIL && (this.provider === 'aws-ses' || this.fallbackOrder.includes('aws-ses'))) {
      return `"Kolocollect" <${process.env.SES_FROM_EMAIL}>`;
    }
    if (process.env.SENDGRID_FROM && (this.provider === 'sendgrid' || this.fallbackOrder.includes('sendgrid'))) {
      return `"Kolocollect" <${process.env.SENDGRID_FROM}>`;
    }
    return `"Kolocollect" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
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
  }
  /**
   * Send email via AWS SES
   */
  async sendWithAWSSES(emailOptions) {
    if (!this.sesClient) {
      throw new Error('AWS SES client not initialized');
    }

    const { to, subject, text, html, from } = emailOptions;
    
    // Prepare the email parameters for SES
    const params = {
      Source: from || this.providerService.fromEmail,
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
}

module.exports = new EmailService();
