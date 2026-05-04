FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Ensure Unix line endings and executable bit regardless of host OS
RUN sed -i 's/\r//' entrypoint.sh && chmod +x entrypoint.sh

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
