const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }
  initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });
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
    }    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    const mailData = {
      communityName: emailData.communityName,
      inviterName: emailData.inviterName,
      inviteLink: emailData.inviteLink,
      customMessage: emailData.customMessage,
      expirationDate: emailData.expirationDate
    };    const mailOptions = {
      from: `"Kolocollect" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: emailData.to,
      subject: `You're invited to join ${emailData.communityName} on Kolocollect`,
      text: this.generateInvitationEmailText(mailData),
      html: this.generateInvitationEmailHTML(mailData)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Invitation email sent successfully:', result.messageId);
      return {        success: true,
        messageId: result.messageId,
        to: emailData.to
      };
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
    
    // Modify subject for reminder
    const mailOptions = {
      from: `"Kolocollect" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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
      const result = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: result.messageId,
        to: invitationData.to
      };
    } catch (error) {
      console.error('Error sending reminder email:', error);
      throw new Error(`Failed to send reminder email: ${error.message}`);
    }
  }

  /**
   * Test email configuration
   * @returns {Promise<boolean>} - Whether email configuration is working
   */
  async testEmailConfiguration() {
    try {
      await this.transporter.verify();
      console.log('Email server configuration is valid');
      return true;
    } catch (error) {
      console.error('Email server configuration error:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
