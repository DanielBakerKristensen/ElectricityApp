# Stage 1: Build dependencies
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the final image
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built files from builder
COPY --from=builder /app/build ./build

# Copy other necessary files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD [ "npm", "start" ]
