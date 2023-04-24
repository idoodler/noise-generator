# Use latest node
FROM node:latest

LABEL authors="idoodler <me@idoodler.de>"

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Set the node env (we only need production dependencies in the deployed image)
ENV NODE_ENV production
ENV PORT 80

# Install dependencies (we deliberately just copy packages.json so we can use the cache if no package.json changes are made)
COPY package.json /usr/src/app/
RUN npm install

# Copy the sources
COPY . /usr/src/app

EXPOSE 80

# Start the service
CMD node ./main.js