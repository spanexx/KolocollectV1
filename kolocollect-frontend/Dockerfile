# Development Dockerfile for Angular application
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including dev dependencies for development)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose port 4200 for Angular dev server
EXPOSE 4200

# Start the Angular development server
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "4200", "--disable-host-check"]
