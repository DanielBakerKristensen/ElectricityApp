# Stage 1: Build dependencies
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Stage 2: Create the final image
FROM node:18-slim

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm install --only=production

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy the rest of the application's source code
COPY . .

# Create a directory for Swagger UI assets
RUN mkdir -p public

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "start"]
