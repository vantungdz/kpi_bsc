FROM node:20-alpine AS builder

# Set the standard working directory
WORKDIR /app

# Copy package definitions first to leverage Docker cache
# This avoids reinstalling dependencies if only the source code changes
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire source code into the container
COPY . .

# Build the application
RUN npm run build

FROM nginx:alpine

# Expose port 5173 (Vite's default port)
# EXPOSE 5173
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# Command to run the application
# Add -- --host to allow Vite to listen for external connections
# CMD ["npm", "run", "dev", "--", "--host"]
CMD ["nginx", "-g", "daemon off;"]
