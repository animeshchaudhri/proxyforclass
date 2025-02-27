FROM ghcr.io/puppeteer/puppeteer:latest
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
CMD ["node", "proxy.js"]
