FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy source code
COPY . .

# Create result directory
RUN mkdir -p result

# Set environment variables
ENV NODE_ENV=production

# Default parancs: extract-shipping.ts (csak a domaint várja)
ENTRYPOINT ["npx", "tsx", "extract-shipping.ts"] 