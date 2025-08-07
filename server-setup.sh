#!/bin/bash

# Server Setup Script for Tolstoy on Ubuntu 22.04
set -e

echo "🔧 Starting server setup..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js v20
echo "📦 Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies
echo "📦 Installing additional dependencies..."
sudo apt-get install -y git build-essential nginx

# Install PM2 globally
echo "🚦 Installing PM2..."
sudo npm install -g pm2

# Install yarn globally
echo "📦 Installing Yarn..."
sudo npm install -g yarn

echo "✅ Server dependencies installed successfully!"
node --version
npm --version
yarn --version
pm2 --version

echo "🔧 Server setup completed!"
