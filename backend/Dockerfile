# =======================================
# Build stage
# =======================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install

# Stage 2: Create the final production image
FROM node:18-alpine

# Set to production
ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp \
    && mkdir -p /app/logs /app/public \
    && chown -R nodeapp:nodeapp /app

# Copy package files and install production dependencies ONLY
COPY --chown=nodeapp:nodeapp package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy source code (using chown for security)
COPY --chown=nodeapp:nodeapp . .

# Use non-root user
USER nodeapp

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "start"]
