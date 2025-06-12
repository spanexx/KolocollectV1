/**
 * Session Service
 * Phase 4: Scalability Improvements - Redis Session Storage
 * 
 * Provides Redis-based session storage for horizontal scaling:
 * - Stores user sessions in Redis for sharing across instances
 * - Implements connection pooling for better performance
 * - Handles session expiration and cleanup
 */

const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class SessionService {
  constructor(options = {}) {
    this.redisClient = new Redis(options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.prefix = options.prefix || 'session:';
    this.ttl = options.ttl || 86400; // 24 hours in seconds
    
    // Setup error handling
    this.redisClient.on('error', (err) => {
      console.error('Redis session service error:', err);
    });
    
    // Setup connection success handling
    this.redisClient.on('connect', () => {
      console.log('Redis session service connected');
    });
  }
  
  /**
   * Create a new session
   * @param {Object} data - Session data to store
   * @returns {Promise<string>} - Session ID
   */
  async createSession(data) {
    const sessionId = uuidv4();
    const key = this.prefix + sessionId;
    
    await this.redisClient.set(key, JSON.stringify(data), 'EX', this.ttl);
    
    return sessionId;
  }
  
  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Session data
   */
  async getSession(sessionId) {
    const key = this.prefix + sessionId;
    const data = await this.redisClient.get(key);
    
    if (!data) {
      return null;
    }
    
    // Extend the session TTL
    await this.redisClient.expire(key, this.ttl);
    
    return JSON.parse(data);
  }
  
  /**
   * Update session data
   * @param {string} sessionId - Session ID
   * @param {Object} data - Session data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateSession(sessionId, data) {
    const key = this.prefix + sessionId;
    const existingData = await this.redisClient.get(key);
    
    if (!existingData) {
      return false;
    }
    
    const mergedData = {
      ...JSON.parse(existingData),
      ...data
    };
    
    await this.redisClient.set(key, JSON.stringify(mergedData), 'EX', this.ttl);
    
    return true;
  }
  
  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSession(sessionId) {
    const key = this.prefix + sessionId;
    const result = await this.redisClient.del(key);
    
    return result === 1;
  }
  
  /**
   * Express middleware to manage sessions
   * @returns {Function} - Express middleware
   */
  middleware() {
    return async (req, res, next) => {
      // Get session ID from cookie or header
      const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
      
      if (sessionId) {
        // Get session data
        const sessionData = await this.getSession(sessionId);
        
        if (sessionData) {
          // Attach session data to request
          req.session = sessionData;
          req.sessionId = sessionId;
          
          // Method to save session data
          req.saveSession = async (data) => {
            await this.updateSession(sessionId, data);
            Object.assign(req.session, data);
          };
        }
      }
      
      // Create new session if none exists
      if (!req.session) {
        const newSessionId = await this.createSession({});
        
        // Set cookie
        res.cookie('sessionId', newSessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: this.ttl * 1000 // Convert to milliseconds
        });
        
        // Attach session data to request
        req.session = {};
        req.sessionId = newSessionId;
        
        // Method to save session data
        req.saveSession = async (data) => {
          await this.updateSession(newSessionId, data);
          Object.assign(req.session, data);
        };
      }
      
      // Continue with request
      next();
    };
  }
  
  /**
   * Close Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    await this.redisClient.quit();
  }
}

// Singleton instance
let sessionService = null;

/**
 * Initialize session service
 * @param {Object} options - Configuration options
 * @returns {SessionService} - Session service instance
 */
const initializeSessionService = (options = {}) => {
  if (!sessionService) {
    sessionService = new SessionService(options);
  }
  
  return sessionService;
};

/**
 * Get session service instance
 * @returns {SessionService} - Session service instance
 */
const getSessionService = () => {
  if (!sessionService) {
    throw new Error('Session service not initialized');
  }
  
  return sessionService;
};

module.exports = {
  initializeSessionService,
  getSessionService
};
