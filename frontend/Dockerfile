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

# Stage 2: Create the final image for development
FROM node:18-slim

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for dev server)
RUN npm install

# Copy the rest of the application
COPY . .

# Increase Node.js memory limit and enable better error reporting
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV GENERATE_SOURCEMAP=false
ENV REACT_APP_FAST_REFRESH=true

# Expose the port the app runs on
EXPOSE 3000

# Use dumb-init to properly handle signals and prevent zombie processes
ENTRYPOINT ["dumb-init", "--"]

# Command to run the application with better error handling
CMD ["sh", "-c", "npm start 2>&1 | tee /app/logs/frontend.log || (echo 'Frontend crashed!' && sleep infinity)"]
