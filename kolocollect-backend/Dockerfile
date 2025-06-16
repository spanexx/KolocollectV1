# Use the official Node.js 18 image as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create necessary directories
RUN mkdir -p config logs uploads temp

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S kolocollect -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R kolocollect:nodejs /app

# Switch to the non-root user
USER kolocollect

# Expose the port the app runs on
EXPOSE 9000

# Set environment variables
ENV NODE_ENV=development
ENV PORT=9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "run", "start:prod"]
