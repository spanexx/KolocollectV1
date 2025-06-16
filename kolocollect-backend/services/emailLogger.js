const fs = require('fs').promises;
const path = require('path');

class EmailLogger {
  constructor() {
    this.logsPath = path.join(__dirname, '..', 'logs');
    this.emailLogsPath = path.join(this.logsPath, 'emails');
    this.initializeLogsDirectory();
  }

  /**
   * Initialize logs directory if it doesn't exist
   */
  async initializeLogsDirectory() {
    try {
      await fs.mkdir(this.logsPath, { recursive: true });
      await fs.mkdir(this.emailLogsPath, { recursive: true });
    } catch (error) {
      console.error('Error initializing logs directory:', error);
    }
  }

  /**
   * Log email sending attempt
   * @param {Object} emailData - Email data
   * @param {Object} result - Email sending result
   * @param {string} status - Email status (success, failed, pending)
   */
  async logEmail(emailData, result = null, status = 'pending') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      status,
      emailType: emailData.type || 'unknown',
      to: emailData.to,
      subject: emailData.subject,
      provider: result?.provider || 'unknown',
      messageId: result?.messageId || null,
      error: result?.error || null,
      userId: emailData.userId || null,
      metadata: emailData.metadata || {}
    };

    try {
      // Daily log file
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.emailLogsPath, `${today}.json`);
      
      // Read existing logs or create empty array
      let logs = [];
      try {
        const existingLogs = await fs.readFile(logFile, 'utf8');
        logs = JSON.parse(existingLogs);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty array
        logs = [];
      }

      // Add new log entry
      logs.push(logEntry);

      // Write back to file
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));

      // Also log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📧 Email logged: ${status.toUpperCase()} - ${emailData.type} to ${emailData.to}`);
      }

    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  /**
   * Get email logs for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of log entries
   */
  async getEmailLogs(date) {
    try {
      const logFile = path.join(this.emailLogsPath, `${date}.json`);
      const logs = await fs.readFile(logFile, 'utf8');
      return JSON.parse(logs);
    } catch (error) {
      console.error(`Error reading email logs for ${date}:`, error);
      return [];
    }
  }

  /**
   * Get email statistics for a date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} - Email statistics
   */
  async getEmailStats(startDate, endDate) {
    const stats = {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      byType: {},
      byProvider: {}
    };

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        const logs = await this.getEmailLogs(dateStr);
        
        logs.forEach(log => {
          stats.total++;
          stats[log.status] = (stats[log.status] || 0) + 1;
          stats.byType[log.emailType] = (stats.byType[log.emailType] || 0) + 1;
          stats.byProvider[log.provider] = (stats.byProvider[log.provider] || 0) + 1;
        });
      }
    } catch (error) {
      console.error('Error calculating email stats:', error);
    }

    return stats;
  }

  /**
   * Get recent email logs (last N entries)
   * @param {number} limit - Number of recent logs to return
   * @returns {Promise<Array>} - Array of recent log entries
   */
  async getRecentEmailLogs(limit = 50) {
    try {
      const files = await fs.readdir(this.emailLogsPath);
      const logFiles = files
        .filter(file => file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      const recentLogs = [];
      
      for (const file of logFiles) {
        if (recentLogs.length >= limit) break;
        
        const logs = await this.getEmailLogs(file.replace('.json', ''));
        recentLogs.push(...logs.reverse()); // Most recent first
        
        if (recentLogs.length > limit) {
          recentLogs.splice(limit);
          break;
        }
      }

      return recentLogs.slice(0, limit);
    } catch (error) {
      console.error('Error getting recent email logs:', error);
      return [];
    }
  }

  /**
   * Clean up old log files (older than specified days)
   * @param {number} daysToKeep - Number of days to keep logs
   */
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const files = await fs.readdir(this.emailLogsPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const filesToDelete = files.filter(file => {
        if (!file.endsWith('.json')) return false;
        
        const fileDate = new Date(file.replace('.json', ''));
        return fileDate < cutoffDate;
      });

      for (const file of filesToDelete) {
        await fs.unlink(path.join(this.emailLogsPath, file));
        console.log(`Deleted old email log: ${file}`);
      }

      if (filesToDelete.length > 0) {
        console.log(`Cleaned up ${filesToDelete.length} old email log files`);
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
}

module.exports = new EmailLogger();
