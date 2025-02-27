FROM ghcr.io/puppeteer/puppeteer:latest

# Environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Switch to root temporarily to handle permissions
USER root

# Create the app directory and set proper permissions
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Set proper ownership for all files
RUN chown -R pptruser:pptruser /app

# Switch back to non-root user for security
USER pptruser

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
  CMD node -e "try { require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => r.statusCode !== 200 ? process.exit(1) : process.exit(0)); } catch (e) { process.exit(1); }"

# Command to run the app
CMD ["node", "proxy.js"]
