const fs = require('fs').promises;
const path = require('path');

class TemplateService {
  constructor() {
    this.templatesPath = path.join(__dirname, '..', 'templates', 'emails');
    this.templateCache = new Map();
  }

  /**
   * Load template from file system
   * @param {string} templatePath - Path to template relative to templates/emails/
   * @param {boolean} useCache - Whether to use cached version (default: true)
   * @returns {Promise<string>} - Template content
   */
  async loadTemplate(templatePath, useCache = true) {
    const fullPath = path.join(this.templatesPath, templatePath);
    
    // Check cache first
    if (useCache && this.templateCache.has(fullPath)) {
      return this.templateCache.get(fullPath);
    }

    try {
      const content = await fs.readFile(fullPath, 'utf8');
      
      // Cache the template
      if (useCache) {
        this.templateCache.set(fullPath, content);
      }
      
      return content;
    } catch (error) {
      console.error(`Error loading template ${templatePath}:`, error);
      throw new Error(`Failed to load email template: ${templatePath}`);
    }
  }

  /**
   * Process template by replacing placeholders with data
   * @param {string} template - Template content
   * @param {Object} data - Data to replace placeholders
   * @returns {string} - Processed template
   */
  processTemplate(template, data = {}) {
    let processedTemplate = template;
    
    // Replace {{variable}} placeholders
    Object.keys(data).forEach(key => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      const value = data[key] || '';
      processedTemplate = processedTemplate.replace(placeholder, value);
    });
    
    // Clean up any remaining placeholders (replace with empty string)
    processedTemplate = processedTemplate.replace(/{{[^}]+}}/g, '');
    
    return processedTemplate;
  }

  /**
   * Load and process template in one step
   * @param {string} templatePath - Path to template
   * @param {Object} data - Data to replace placeholders
   * @param {boolean} useCache - Whether to use cached version
   * @returns {Promise<string>} - Processed template
   */
  async loadAndProcess(templatePath, data = {}, useCache = true) {
    const template = await this.loadTemplate(templatePath, useCache);
    return this.processTemplate(template, data);
  }

  /**
   * Get welcome email templates (both HTML and text)
   * @param {Object} userData - User data for template processing
   * @returns {Promise<Object>} - Object with html and text properties
   */
  async getWelcomeEmailTemplates(userData) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    
    const templateData = {
      userName: userData.name || 'New Member',
      userEmail: userData.email || '',
      dashboardUrl: `${baseUrl}/dashboard`,
      profileUrl: `${baseUrl}/profile`,
      helpCenterUrl: `${baseUrl}/help`,
      facebookUrl: 'https://facebook.com/kolocollect',
      twitterUrl: 'https://twitter.com/kolocollect',
      linkedinUrl: 'https://linkedin.com/company/kolocollect',
      instagramUrl: 'https://instagram.com/kolocollect',
      currentYear: new Date().getFullYear(),
      ...userData // Allow overriding with custom data
    };

    try {
      const [htmlTemplate, textTemplate] = await Promise.all([
        this.loadAndProcess('welcome/welcome.html', templateData),
        this.loadAndProcess('welcome/welcome.txt', templateData)
      ]);

      return {
        html: htmlTemplate,
        text: textTemplate
      };
    } catch (error) {
      console.error('Error loading welcome email templates:', error);
      throw error;
    }
  }

  /**
   * Get invitation email templates (for future migration)
   * @param {Object} invitationData - Invitation data for template processing
   * @returns {Promise<Object>} - Object with html and text properties
   */
  async getInvitationEmailTemplates(invitationData) {
    // This can be implemented when migrating existing invitation templates
    // For now, we'll use the existing email service templates
    throw new Error('Invitation templates not yet migrated to template service');
  }

  /**
   * Get password reset email templates
   * @param {Object} resetData - Reset data for template processing
   * @returns {Promise<Object>} - Object with html and text properties
   */
  async getPasswordResetEmailTemplates(resetData) {
    // Future implementation for password reset emails
    throw new Error('Password reset templates not yet implemented');
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
  }

  /**
   * Get all available templates
   * @returns {Promise<Array>} - Array of available template paths
   */
  async getAvailableTemplates() {
    try {
      const templates = [];
      await this.scanDirectory(this.templatesPath, '', templates);
      return templates;
    } catch (error) {
      console.error('Error scanning templates directory:', error);
      return [];
    }
  }

  /**
   * Recursively scan directory for templates
   * @private
   */
  async scanDirectory(dirPath, relativePath, templates) {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativeItemPath = path.join(relativePath, item);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await this.scanDirectory(fullPath, relativeItemPath, templates);
      } else if (item.endsWith('.html') || item.endsWith('.txt')) {
        templates.push(relativeItemPath.replace(/\\/g, '/'));
      }
    }
  }

  /**
   * Validate template syntax (check for common issues)
   * @param {string} templatePath - Path to template to validate
   * @returns {Promise<Object>} - Validation result
   */
  async validateTemplate(templatePath) {
    try {
      const template = await this.loadTemplate(templatePath, false);
      const issues = [];
      
      // Check for unclosed placeholders
      const unclosedPattern = /{{[^}]*$/gm;
      const unclosedMatches = template.match(unclosedPattern);
      if (unclosedMatches) {
        issues.push({
          type: 'syntax',
          message: 'Found unclosed placeholders',
          matches: unclosedMatches
        });
      }

      // Check for malformed placeholders
      const malformedPattern = /{{[{}]/g;
      const malformedMatches = template.match(malformedPattern);
      if (malformedMatches) {
        issues.push({
          type: 'syntax',
          message: 'Found malformed placeholders',
          matches: malformedMatches
        });
      }

      // Extract all placeholders
      const placeholders = [];
      const placeholderPattern = /{{([^}]+)}}/g;
      let match;
      while ((match = placeholderPattern.exec(template)) !== null) {
        placeholders.push(match[1].trim());
      }

      return {
        valid: issues.length === 0,
        issues,
        placeholders: [...new Set(placeholders)] // Remove duplicates
      };
    } catch (error) {
      return {
        valid: false,
        issues: [{
          type: 'file',
          message: error.message
        }],
        placeholders: []
      };
    }
  }
}

module.exports = new TemplateService();
