FROM node:20-bullseye-slim

# Install Python (required by the YouTube downloader)
RUN apt-get update && apt-get install -y python3 python-is-python3

# Setup the backend app
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 4000
CMD ["npm", "start"]
