#!/bin/bash

# Oracle Cloud deployment skript pre Chat Server
set -euo pipefail

# Konfigurácia
SERVER_IP="129.159.9.170"
SSH_KEY="/Users/hotovo/Documents/augment-projects/chatko/ssh-key-2025-07-16 (3).key"
SSH_USER="ubuntu"
REPO_URL="https://github.com/SemanS/chat-server.git"

# Farby pre výstup
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

# Funkcia na deployment na Oracle Cloud
deploy_to_oracle() {
    log "🚀 Spúšťam deployment na Oracle Cloud..."
    
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
set -e

echo "🌐 Oracle Cloud Chat Server Deployment"
echo "======================================"

# Aktualizácia systému
echo "📦 Aktualizujem systém..."
sudo apt-get update -qq

# Inštalácia Git ak nie je nainštalovaný
if ! command -v git &> /dev/null; then
    echo "📥 Inštalujem Git..."
    sudo apt-get install -y git
fi

# Inštalácia Docker ak nie je nainštalovaný
if ! command -v docker &> /dev/null; then
    echo "🐳 Inštalujem Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    sudo systemctl enable docker
    sudo systemctl start docker
    rm get-docker.sh
fi

# Inštalácia Docker Compose ak nie je nainštalovaný
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Inštalujem Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Zastavenie existujúcich kontajnerov
if [[ -d "/home/ubuntu/chat-server" ]]; then
    echo "🛑 Zastavujem existujúce kontajnery..."
    cd /home/ubuntu/chat-server
    docker-compose down || true
    cd /home/ubuntu
fi

# Backup existujúcej inštalácie
if [[ -d "/home/ubuntu/chat-server" ]]; then
    echo "💾 Vytváram backup..."
    sudo mv /home/ubuntu/chat-server /home/ubuntu/chat-server-backup-$(date +%Y%m%d_%H%M%S)
fi

# Clone repository
echo "📥 Sťahujem najnovú verziu..."
git clone https://github.com/SemanS/chat-server.git
cd chat-server

# Vytvorenie .env súboru
echo "⚙️ Konfigururjem environment..."
if [[ ! -f .env ]]; then
    cp .env.example .env
    
    # Základná konfigurácia
    sed -i 's/NODE_ENV=production/NODE_ENV=production/' .env
    sed -i 's/PORT=3000/PORT=3000/' .env
    sed -i 's/HOST=0.0.0.0/HOST=0.0.0.0/' .env
    
    echo "✅ .env súbor vytvorený - prosím nakonfiguruj API kľúče"
fi

# Vytvorenie potrebných adresárov
echo "📁 Vytváram adresáre..."
mkdir -p logs tmp ssl nginx/conf.d

# Vytvorenie základnej Nginx konfigurácie
if [[ ! -f nginx/nginx.conf ]]; then
    echo "🌐 Vytváram Nginx konfiguráciu..."
    
    cat > nginx/nginx.conf << 'NGINX_EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=websocket:10m rate=5r/s;
    
    # Include server configs
    include /etc/nginx/conf.d/*.conf;
}
NGINX_EOF

    cat > nginx/conf.d/chat-server.conf << 'SERVER_EOF'
# Upstream pre Chat Server
upstream chat_server_backend {
    server chat-server:3000;
    keepalive 32;
}

# HTTP server (redirect na HTTPS)
server {
    listen 80;
    server_name _;
    
    # Health check endpoint
    location /health {
        proxy_pass http://chat_server_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        access_log off;
    }
    
    # Redirect na HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name _;
    
    # SSL konfigurácia (self-signed pre začiatok)
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With' always;
    
    # WebSocket endpoint
    location /ws {
        limit_req zone=websocket burst=10 nodelay;
        
        proxy_pass http://chat_server_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
    }
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://chat_server_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Health check
    location /health {
        proxy_pass http://chat_server_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        access_log off;
    }
    
    # WebSocket test page
    location /websocket-test.html {
        proxy_pass http://chat_server_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Ostatné requesty
    location / {
        proxy_pass http://chat_server_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
SERVER_EOF
fi

# Build a spustenie kontajnerov
echo "🐳 Buildujem a spúšťam kontajnery..."

# Ensure Docker group membership is active
newgrp docker << 'DOCKER_EOF'
# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Wait for services to start
echo "⏳ Čakám na spustenie služieb..."
sleep 30

# Check status
echo "📊 Kontrolujem stav kontajnerov..."
docker-compose ps

# Test health check
echo "🧪 Testujem health check..."
if curl -f http://localhost/health; then
    echo "✅ HTTP health check úspešný"
else
    echo "❌ HTTP health check zlyhal"
fi

if curl -k -f https://localhost/health; then
    echo "✅ HTTPS health check úspešný"
else
    echo "❌ HTTPS health check zlyhal"
fi

echo "🎉 Deployment dokončený!"
DOCKER_EOF

echo ""
echo "🌐 Chat Server je dostupný na:"
echo "   HTTP:  http://129.159.9.170"
echo "   HTTPS: https://129.159.9.170"
echo "   WebSocket: wss://129.159.9.170/ws"
echo "   Test Page: https://129.159.9.170/websocket-test.html"
echo ""
echo "📋 Ďalšie kroky:"
echo "   1. Nakonfiguruj API kľúče v .env súbore"
echo "   2. Nastav Oracle Cloud Security List (porty 80, 443)"
echo "   3. Vygeneruj SSL certifikáty pre produkciu"
echo "   4. Otestuj WebSocket komunikáciu"
echo ""
echo "🔧 Správa:"
echo "   docker-compose ps              # Status kontajnerov"
echo "   docker-compose logs -f         # Logy"
echo "   docker-compose restart         # Restart"
echo "   docker-compose down            # Stop"
EOF
    
    success "Deployment na Oracle Cloud dokončený"
}

# Hlavná funkcia
main() {
    log "🚀 Oracle Cloud Chat Server Deployment"
    echo ""
    echo "📋 Deployment info:"
    echo "   Server: $SERVER_IP"
    echo "   Repository: $REPO_URL"
    echo "   SSH Key: $SSH_KEY"
    echo ""
    
    read -p "Pokračovať s deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment zrušený"
        exit 0
    fi
    
    # Kontrola SSH kľúča
    if [[ ! -f "$SSH_KEY" ]]; then
        error "SSH kľúč nenájdený: $SSH_KEY"
        exit 1
    fi
    
    # Deployment
    deploy_to_oracle
    
    success "🎉 Oracle Cloud Chat Server deployment úspešne dokončený!"
    echo ""
    echo "🌐 Server je dostupný na:"
    echo "   HTTP:  http://$SERVER_IP"
    echo "   HTTPS: https://$SERVER_IP"
    echo "   WebSocket: wss://$SERVER_IP/ws"
    echo ""
    echo "📋 Ďalšie kroky:"
    echo "   1. Nakonfiguruj Oracle Cloud Security List"
    echo "   2. Nastav API kľúče v .env súbore"
    echo "   3. Vygeneruj SSL certifikáty"
    echo "   4. Otestuj všetky endpoints"
}

# Spustenie
main "$@"
