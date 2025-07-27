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
RUN mkdir -p result-returns-v2

# Set environment variables
ENV NODE_ENV=production

# Use the correct entrypoint script
ENTRYPOINT ["npx", "tsx", "extract-returns-v2.ts"] 