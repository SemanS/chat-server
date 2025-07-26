#!/bin/bash

# Deploy Nginx configuration for Oracle Voice Chat
# This script updates the Nginx configuration on Oracle VM

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
NGINX_CONFIG_FILE="nginx/conf.d/voice-chat.conf"
BACKUP_DIR="nginx/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log "🚀 Starting Nginx configuration deployment..."

# Check if we're in the correct directory
if [[ ! -f "$NGINX_CONFIG_FILE" ]]; then
    error "Nginx config file not found: $NGINX_CONFIG_FILE"
    error "Please run this script from the chat-backend directory"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Validate Nginx configuration
log "🔍 Validating Nginx configuration..."

# Check for required sections
if ! grep -q "map \$http_origin \$cors_origin" "$NGINX_CONFIG_FILE"; then
    error "CORS origin map not found in configuration"
    exit 1
fi

if ! grep -q "voice-chat.vocabu.io" "$NGINX_CONFIG_FILE"; then
    error "voice-chat.vocabu.io not found in CORS configuration"
    exit 1
fi

if ! grep -q "oracle-voice-chat.pages.dev" "$NGINX_CONFIG_FILE"; then
    error "oracle-voice-chat.pages.dev not found in CORS configuration"
    exit 1
fi

success "Nginx configuration validation passed"

# Display current CORS configuration
log "📋 Current CORS configuration:"
echo ""
grep -A 5 "map \$http_origin \$cors_origin" "$NGINX_CONFIG_FILE"
echo ""

# Test configuration syntax (if nginx is available)
if command -v nginx &> /dev/null; then
    log "🧪 Testing Nginx syntax..."
    if nginx -t -c "$(pwd)/$NGINX_CONFIG_FILE" 2>/dev/null; then
        success "Nginx syntax test passed"
    else
        warning "Nginx syntax test failed (this is normal if not running on Oracle VM)"
    fi
else
    warning "Nginx not available for syntax testing"
fi

# Show deployment instructions
log "📋 Deployment Instructions for Oracle VM:"
echo ""
echo "1. Copy the configuration file to Oracle VM:"
echo "   scp $NGINX_CONFIG_FILE oracle-vm:/etc/nginx/conf.d/"
echo ""
echo "2. Copy SSL certificates:"
echo "   scp ssl/origin-cert.pem oracle-vm:/etc/ssl/cloudflare/"
echo "   scp ssl/origin-cert.key oracle-vm:/etc/ssl/cloudflare/"
echo ""
echo "3. Test Nginx configuration on Oracle VM:"
echo "   sudo nginx -t"
echo ""
echo "4. Reload Nginx configuration:"
echo "   sudo systemctl reload nginx"
echo ""
echo "5. Verify CORS headers:"
echo "   curl -H \"Origin: https://voice-chat.vocabu.io\" -I https://129.159.9.170/health"
echo ""

# Create deployment package
PACKAGE_NAME="nginx-config-${TIMESTAMP}.tar.gz"
log "📦 Creating deployment package: $PACKAGE_NAME"

tar -czf "$PACKAGE_NAME" \
    nginx/conf.d/voice-chat.conf \
    ssl/origin-cert.pem \
    ssl/origin-cert.key \
    2>/dev/null || {
    warning "Some SSL files may be missing, creating package with available files"
    tar -czf "$PACKAGE_NAME" nginx/conf.d/voice-chat.conf
}

success "Deployment package created: $PACKAGE_NAME"

# Test CORS configuration locally (if server is running)
log "🧪 Testing CORS configuration locally..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo ""
    echo "Testing voice-chat.vocabu.io:"
    curl -H "Origin: https://voice-chat.vocabu.io" -I http://localhost:3000/health 2>/dev/null | grep -i "access-control-allow-origin" || echo "No CORS header found"
    
    echo ""
    echo "Testing oracle-voice-chat.pages.dev:"
    curl -H "Origin: https://oracle-voice-chat.pages.dev" -I http://localhost:3000/health 2>/dev/null | grep -i "access-control-allow-origin" || echo "No CORS header found"
    
    echo ""
    echo "Testing unauthorized origin:"
    curl -H "Origin: https://example.com" -I http://localhost:3000/health 2>/dev/null | grep -i "access-control-allow-origin" || echo "No CORS header found (expected)"
else
    warning "Local server not running, skipping CORS tests"
fi

echo ""
success "🎉 Nginx configuration deployment preparation completed!"
echo ""
log "📋 Next steps:"
echo "1. Transfer $PACKAGE_NAME to Oracle VM"
echo "2. Extract and deploy the configuration"
echo "3. Test the WebSocket connection from frontend"
echo ""
log "🔗 Test URLs after deployment:"
echo "- Frontend: https://voice-chat.vocabu.io"
echo "- Backend Health: https://129.159.9.170/health"
echo "- WebSocket: wss://129.159.9.170/ws"
