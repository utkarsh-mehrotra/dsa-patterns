#!/bin/bash
# =========================================================================
# AlgoFlow VM Environment Setup Automation Script
# Targets: Ubuntu 22.04 LTS or Debian Linux systems
# =========================================================================

set -e

echo "🚀 Starting AlgoFlow VM environment provisioning..."

# 1. Update and Upgrade System Package Registry
echo "📦 Updating system package registry..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Standard Build Dependencies and Tools
echo "🛠️ Installing basic utilities (git, curl, build-essential)..."
sudo apt-get install -y git curl build-essential wget certbot python3-certbot-nginx nginx

# 3. Install Node.js (v20.x LTS)
echo "🟢 Installing Node.js v20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v

# 4. Install Docker Engine
echo "🐳 Installing Docker Engine..."
sudo apt-get install -y apt-transport-https ca-certificates software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Start and Enable Docker Daemon
echo "🔄 Initializing and enabling Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group to execute commands without sudo
sudo usermod -aG docker $USER
echo "✅ Docker installed. Note: You may need to log out and log back in to run docker commands without sudo."

# 5. Install Language Server Binaries (LSP Gateway Dependencies)
echo "🎯 Installing compilation tools and Language Servers (clangd, pyright)..."
sudo apt-get install -y clangd
sudo npm install -g pyright

# Verify installations
clangd --version
pyright --version

# 6. Build the Local Compiler Sandbox Docker Image
echo "🛡️ Building compiler execution sandbox Docker container..."
if [ -f Dockerfile.sandbox ]; then
    sudo docker build -t algoflow-compiler-sandbox -f Dockerfile.sandbox .
    echo "✅ Docker sandbox image 'algoflow-compiler-sandbox' compiled successfully."
else
    echo "⚠️ Dockerfile.sandbox not found in current directory. Image compilation skipped."
fi

# 7. Install PM2 Globally
echo "🚀 Installing PM2 Process Manager..."
sudo npm install -g pm2

# 8. Install NPM Dependencies & Build Production Assets
echo "📦 Installing project packages and compiling Vite UI bundle..."
npm install
npm run build

echo "========================================================================="
echo "🎉 AlgoFlow VM Environment Provisioning Complete!"
echo "========================================================================="
echo "Next Steps to Complete Deployment:"
echo "1. Configure your environment variables (.env file with Razorpay keys)."
echo "2. Start the unified server using PM2:"
echo "   pm2 start ecosystem.config.json --env production"
echo "3. Copy nginx.conf.template to /etc/nginx/sites-available/algoflow"
echo "4. Enable Nginx site and restart:"
echo "   sudo ln -s /etc/nginx/sites-available/algoflow /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl restart nginx"
echo "5. Configure HTTPS/WSS with Certbot:"
echo "   sudo certbot --nginx -d yourdomain.com"
echo "========================================================================="
