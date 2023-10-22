# Use an official Node.js runtime as the base image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY front_end/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the application code
COPY front_end/ ./

# Build the React app
RUN npm run build

# Expose port 3000 for the frontend
EXPOSE 3000

# Command to run when the container starts
CMD ["npm", "start"]
