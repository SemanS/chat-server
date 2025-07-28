#!/bin/bash

# Universal Oracle Voice Chat Backend Deployment Script
# Univerzálny deployment script pre Oracle Voice Chat Backend
set -euo pipefail

# ============================================================================
# KONFIGURÁCIA - UPRAVTE PODĽA POTREBY
# ============================================================================

# Server konfigurácia
SERVER_IP="${SERVER_IP:-129.159.9.170}"
SSH_KEY="${SSH_KEY:-/Users/hotovo/Documents/augment-projects/chat/ssh-key-2025-07-16 (3).key}"
SSH_USER="${SSH_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/chat-server}"

# API kľúče (môžu byť nastavené ako environment variables)
DEEPGRAM_API_KEY="${DEEPGRAM_API_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

# TTS konfigurácia - Piper TTS Server
TTS_VOICE="${TTS_VOICE:-sk_SK-lili-medium}"
PIPER_TTS_PORT="${PIPER_TTS_PORT:-5000}"
PIPER_VOICES_URL="${PIPER_VOICES_URL:-https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx}"
PIPER_VOICES_JSON_URL="${PIPER_VOICES_JSON_URL:-https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx.json}"

# Farby pre výstup
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# UTILITY FUNKCIE
# ============================================================================

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

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# Kontrola prerekvizít
check_prerequisites() {
    log "Kontrolujem prerekvizity..."
    
    # Kontrola SSH kľúča
    if [[ ! -f "$SSH_KEY" ]]; then
        error "SSH kľúč nenájdený: $SSH_KEY"
        exit 1
    fi
    
    # Kontrola prístupu na server
    if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes "$SSH_USER@$SERVER_IP" exit 2>/dev/null; then
        error "Nemôžem sa pripojiť na server $SERVER_IP"
        exit 1
    fi
    
    success "Prerekvizity v poriadku"
}

# Zobrazenie konfigurácie
show_config() {
    echo ""
    echo -e "${PURPLE}🚀 ORACLE VOICE CHAT BACKEND DEPLOYMENT${NC}"
    echo "=============================================="
    echo ""
    echo -e "${CYAN}📋 Konfigurácia:${NC}"
    echo "   Server IP:     $SERVER_IP"
    echo "   SSH User:      $SSH_USER"
    echo "   SSH Key:       $SSH_KEY"
    echo "   Remote Dir:    $REMOTE_DIR"
    echo "   TTS Voice:     $TTS_VOICE"
    echo "   TTS Server:    Piper TTS (port $PIPER_TTS_PORT)"
    echo ""
    echo -e "${CYAN}🔑 API Keys:${NC}"
    echo "   Deepgram:      ${DEEPGRAM_API_KEY:+✅ Nastavený}${DEEPGRAM_API_KEY:-❌ Nenastavený}"
    echo "   OpenAI:        ${OPENAI_API_KEY:+✅ Nastavený}${OPENAI_API_KEY:-❌ Nenastavený}"
    echo ""
}

# Potvrdenie deployment
confirm_deployment() {
    echo -e "${YELLOW}⚠️  Toto nasadí nový backend na produkčný server!${NC}"
    echo ""
    read -p "Pokračovať s deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment zrušený"
        exit 0
    fi
}

# ============================================================================
# DEPLOYMENT FUNKCIE
# ============================================================================

# Príprava lokálneho kódu
prepare_local_code() {
    step "Pripravujem lokálny kód..."
    
    # Kontrola, či sme v správnom adresári
    if [[ ! -f "package.json" ]] || [[ ! -f "server.js" ]]; then
        error "Nie ste v adresári s backend kódom!"
        exit 1
    fi
    
    # Vytvorenie dočasného tar súboru
    log "Vytváram archív kódu..."
    tar --exclude='node_modules' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='tmp' \
        --exclude='*.log' \
        --exclude='*.tar.gz' \
        -czf /tmp/backend-deploy.tar.gz .
    
    success "Lokálny kód pripravený"
}

# Nasadenie kódu na server
deploy_code() {
    step "Nasadzujem kód na server..."
    
    # Kopírovanie archívu na server
    log "Kopírujem kód na server..."
    scp -i "$SSH_KEY" /tmp/backend-deploy.tar.gz "$SSH_USER@$SERVER_IP:/tmp/"
    
    # Nasadenie na serveri
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

echo "🔄 Nasadzujem Oracle Voice Chat Backend..."

# Zastavenie existujúcich služieb
if [[ -d "$REMOTE_DIR" ]]; then
    echo "🛑 Zastavujem existujúce služby..."
    cd "$REMOTE_DIR"
    docker-compose down || true
    cd /home/ubuntu
fi

# Backup existujúcej inštalácie
if [[ -d "$REMOTE_DIR" ]]; then
    echo "💾 Vytváram backup..."
    sudo mv "$REMOTE_DIR" "${REMOTE_DIR}-backup-\$(date +%Y%m%d_%H%M%S)"
fi

# Vytvorenie nového adresára
echo "📁 Vytváram nový adresár..."
mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"

# Rozbalenie kódu
echo "📦 Rozbaľujem kód..."
tar -xzf /tmp/backend-deploy.tar.gz
rm /tmp/backend-deploy.tar.gz

# Vytvorenie potrebných adresárov
echo "📁 Vytváram potrebné adresáre..."
mkdir -p logs tmp/tts_cache tmp/audio_uploads ssl nginx/conf.d piper-models

echo "✅ Kód nasadený"
EOF
    
    success "Kód nasadený na server"
}

# Inštalácia systémových závislostí
install_system_dependencies() {
    step "Inštalujem systémové závislosti..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
set -e

echo "📦 Aktualizujem systém..."
sudo apt-get update -qq

# Inštalácia základných nástrojov
echo "🔧 Inštalujem základné nástroje..."
sudo apt-get install -y curl wget git unzip build-essential

# Inštalácia Docker ak nie je nainštalovaný
if ! command -v docker &> /dev/null; then
    echo "🐳 Inštalujem Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    sudo systemctl enable docker
    sudo systemctl start docker
    rm get-docker.sh

    # Reštart session pre Docker group
    echo "🔄 Reštartujem session pre Docker group..."
    newgrp docker
fi

# Inštalácia Docker Compose ak nie je nainštalovaný
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Inštalujem Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "✅ Systémové závislosti nainštalované"
EOF

    success "Systémové závislosti nainštalované"
}

# Nastavenie Piper TTS Server
setup_piper_tts_server() {
    step "Nastavujem Piper TTS Server..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

echo "🔊 Nastavujem Piper TTS Server..."

cd "$REMOTE_DIR"

# Vytvorenie adresára pre hlasové modely
echo "📁 Vytváram adresár pre hlasové modely..."
mkdir -p piper-data

# Stiahnutie slovenského voice modelu ak neexistuje
if [[ ! -f "piper-data/$TTS_VOICE.onnx" ]]; then
    echo "📥 Sťahujem slovenský voice model..."
    cd piper-data

    # Stiahnutie ONNX modelu
    wget -q -O "$TTS_VOICE.onnx" "$PIPER_VOICES_URL"

    # Stiahnutie JSON konfigurácie
    wget -q -O "$TTS_VOICE.onnx.json" "$PIPER_VOICES_JSON_URL"

    echo "✅ Voice model $TTS_VOICE stiahnutý"
    cd ..
fi

# Vytvorenie Docker Compose súboru pre Piper TTS
echo "🐳 Vytváram Docker Compose pre Piper TTS..."
cat > docker-compose.piper-tts.yml << 'DOCKER_EOF'
version: '3.8'

services:
  # Oficiálny Wyoming Piper TTS server
  piper-tts-server:
    image: rhasspy/wyoming-piper:latest
    container_name: piper-tts-server
    ports:
      - "$PIPER_TTS_PORT:5000"    # HTTP API
      - "10200:10200"             # Wyoming protokol
    volumes:
      - ./piper-data:/data
    command: >
      --voice $TTS_VOICE
      --http-port 5000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - voice-chat-network

networks:
  voice-chat-network:
    external: true
DOCKER_EOF

echo "✅ Piper TTS Server nakonfigurovaný"
EOF

    success "Piper TTS Server nakonfigurovaný"
}

# Konfigurácia environment variables
configure_environment() {
    step "Konfigururjem environment..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

cd "$REMOTE_DIR"

echo "⚙️ Vytváram .env súbor..."

# Vytvorenie .env súboru
cat > .env << 'ENV_EOF'
# Oracle Voice Chat Backend - Production Environment
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TZ=Europe/Bratislava

# API Keys
DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY:-mock}
OPENAI_API_KEY=${OPENAI_API_KEY:-mock}

# OpenAI Configuration
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
OPENAI_SYSTEM_PROMPT=Si užitočný AI asistent. Odpovedaj v slovenčine, buď stručný a priateľský. Ak dostaneš otázku v inom jazyku, odpovedaj v tom istom jazyku.

# Redis Configuration
USE_REDIS=false
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=oracleVoiceChat2024

# CORS Configuration
ALLOWED_ORIGINS=*

# SSL/TLS Configuration
SSL_CERT_PATH=/etc/ssl/cloudflare/origin.crt
SSL_KEY_PATH=/etc/ssl/cloudflare/origin.key

# TTS Configuration - Remote Piper TTS Server
TTS_VOICE=$TTS_VOICE
TTS_CACHE_ENABLED=true
PIPER_TTS_URL=http://piper-tts-server:5000
# Fallback local Piper (disabled by default)
# PIPER_PATH=/usr/local/bin/piper
# PIPER_VOICES_PATH=/app/voices

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=info

# Session Configuration
SESSION_SECRET=\$(openssl rand -base64 32)
SESSION_MAX_AGE=86400000

# Development flags
MOCK_SERVICES=false
DEBUG=voice-chat:*
ENV_EOF

echo "✅ Environment nakonfigurovaný"
EOF

    success "Environment nakonfigurovaný"
}

# Konfigurácia Docker Compose pre Piper TTS Server
configure_docker_compose() {
    step "Konfigururjem Docker Compose..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

cd "$REMOTE_DIR"

echo "🐳 Aktualizujem docker-compose.yml pre Piper TTS Server..."

# Vytvorenie Docker network ak neexistuje
if ! docker network ls | grep -q "voice-chat-network"; then
    echo "🌐 Vytváram Docker network..."
    docker network create voice-chat-network
fi

# Pridanie PIPER_TTS_URL environment variable
if ! grep -q "PIPER_TTS_URL" docker-compose.yml; then
    sed -i '/- USE_REDIS=\${USE_REDIS:-false}/a\      - PIPER_TTS_URL=http://piper-tts-server:5000\n      - TTS_VOICE=$TTS_VOICE\n      - TTS_CACHE_ENABLED=true' docker-compose.yml
fi

# Pridanie external network do docker-compose.yml
if ! grep -q "voice-chat-network" docker-compose.yml; then
    echo "" >> docker-compose.yml
    echo "networks:" >> docker-compose.yml
    echo "  default:" >> docker-compose.yml
    echo "    external:" >> docker-compose.yml
    echo "      name: voice-chat-network" >> docker-compose.yml
fi

echo "✅ Docker Compose nakonfigurovaný pre Piper TTS Server"
EOF

    success "Docker Compose nakonfigurovaný"
}

# Build a spustenie služieb s Piper TTS Server
build_and_start_services() {
    step "Buildujem a spúšťam služby..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

cd "$REMOTE_DIR"

echo "🔊 Spúšťam Piper TTS Server..."
docker-compose -f docker-compose.piper-tts.yml up -d piper-tts-server

echo "⏳ Čakám na spustenie Piper TTS Server..."
sleep 20

# Test Piper TTS Server
echo "🧪 Testujem Piper TTS Server..."
for i in {1..10}; do
    if curl -f http://localhost:$PIPER_TTS_PORT >/dev/null 2>&1; then
        echo "✅ Piper TTS Server je dostupný"
        break
    fi
    echo "⏳ Čakám na Piper TTS Server... (\$i/10)"
    sleep 5
done

echo "🐳 Buildujem hlavnú aplikáciu..."
docker-compose build --no-cache voice-chat-backend

echo "🚀 Spúšťam hlavné služby..."
docker-compose up -d voice-chat-backend redis

# Čakanie na spustenie služieb
echo "⏳ Čakám na spustenie hlavných služieb..."
sleep 30

echo "✅ Všetky služby spustené"
EOF

    success "Služby spustené"
}

# Testovanie deployment
test_deployment() {
    step "Testujem deployment..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

cd "$REMOTE_DIR"

echo "🧪 Testujem služby..."

# Kontrola stavu kontajnerov
echo "📊 Stav kontajnerov:"
docker-compose ps

# Test health check
echo "🏥 Testovanie health check..."
sleep 10

if curl -f http://localhost:3000/health; then
    echo "✅ Health check úspešný"
else
    echo "❌ Health check zlyhal"
    exit 1
fi

# Test Deepgram API
echo "🎤 Testovanie Deepgram API..."
if curl -f http://localhost:3000/api/deepgram/status; then
    echo "✅ Deepgram API dostupné"
else
    echo "❌ Deepgram API nedostupné"
fi

# Test OpenAI API
echo "🤖 Testovanie OpenAI API..."
if curl -f http://localhost:3000/api/chat/status; then
    echo "✅ OpenAI API dostupné"
else
    echo "❌ OpenAI API nedostupné"
fi

# Test Piper TTS Server
echo "🔊 Testovanie Piper TTS Server..."
if curl -X POST -H "Content-Type: application/json" -d "{\"text\":\"Test slovenského hlasu\", \"voice\":\"$TTS_VOICE\"}" http://localhost:$PIPER_TTS_PORT/api/tts --output /tmp/test.wav && ls -la /tmp/test.wav; then
    echo "✅ Piper TTS Server test úspešný"
    rm -f /tmp/test.wav
else
    echo "❌ Piper TTS Server test zlyhal"
fi

# Test TTS API v aplikácii
echo "🔊 Testovanie TTS API v aplikácii..."
if curl -X POST -H "Content-Type: application/json" -d "{\"text\":\"Test TTS API v aplikácii\"}" http://localhost:3000/api/tts/synthesize --output /tmp/app-test.wav && ls -la /tmp/app-test.wav; then
    echo "✅ TTS API test úspešný"
    rm -f /tmp/app-test.wav
else
    echo "❌ TTS API test zlyhal"
fi

echo "✅ Všetky testy úspešné"
EOF

    success "Deployment otestovaný"
}

# Zobrazenie výsledkov
show_results() {
    echo ""
    echo -e "${GREEN}🎉 DEPLOYMENT ÚSPEŠNE DOKONČENÝ!${NC}"
    echo "=============================================="
    echo ""
    echo -e "${CYAN}🌐 Server je dostupný na:${NC}"
    echo "   HTTP:      http://$SERVER_IP:3000"
    echo "   HTTPS:     https://$SERVER_IP"
    echo "   WebSocket: wss://$SERVER_IP/ws"
    echo "   Test Page: https://$SERVER_IP/websocket-test.html"
    echo ""
    echo -e "${CYAN}🔧 Správa služieb:${NC}"
    echo "   docker-compose ps              # Stav kontajnerov"
    echo "   docker-compose logs -f         # Logy"
    echo "   docker-compose restart         # Restart"
    echo "   docker-compose down            # Stop"
    echo ""
    echo -e "${CYAN}🧪 Testovanie:${NC}"
    echo "   curl http://$SERVER_IP:3000/health"
    echo "   curl http://$SERVER_IP:3000/api/deepgram/status"
    echo "   curl http://$SERVER_IP:3000/api/chat/status"
    echo ""
    echo -e "${YELLOW}📋 Ďalšie kroky:${NC}"
    echo "   1. Otestuj voice chat funkcionalitu"
    echo "   2. Skontroluj logy: ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'cd $REMOTE_DIR && docker-compose logs -f'"
    echo "   3. Nastav Oracle Cloud Security List (porty 80, 443, 3000)"
    echo "   4. Nakonfiguruj SSL certifikáty pre produkciu"
    echo ""
}

# Cleanup funkcia
cleanup() {
    log "Čistím dočasné súbory..."
    rm -f /tmp/backend-deploy.tar.gz
}

# ============================================================================
# HLAVNÁ FUNKCIA
# ============================================================================

main() {
    # Trap pre cleanup
    trap cleanup EXIT

    # Zobrazenie konfigurácie
    show_config

    # Potvrdenie deployment
    confirm_deployment

    # Kontrola prerekvizít
    check_prerequisites

    log "🚀 Spúšťam deployment..."
    echo ""

    # Deployment kroky
    prepare_local_code
    deploy_code
    install_system_dependencies
    setup_piper_tts_server
    configure_environment
    configure_docker_compose
    build_and_start_services
    test_deployment

    # Zobrazenie výsledkov
    show_results

    success "🎉 Universal Oracle Voice Chat Backend deployment dokončený!"
}

# ============================================================================
# POMOCNÉ FUNKCIE PRE RÔZNE SCENÁRE
# ============================================================================

# Funkcia pre quick deployment (bez potvrdenia)
quick_deploy() {
    export SKIP_CONFIRMATION=true
    main
}

# Funkcia pre deployment len kódu (bez systémových závislostí)
code_only_deploy() {
    show_config
    confirm_deployment
    check_prerequisites
    prepare_local_code
    deploy_code

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
cd "$REMOTE_DIR"
docker-compose restart voice-chat-backend
EOF

    success "Kód aktualizovaný a služby reštartované"
}

# Funkcia pre rollback na predchádzajúcu verziu
rollback() {
    warning "Spúšťam rollback na predchádzajúcu verziu..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << EOF
set -e

# Nájdenie posledného backup adresára
BACKUP_DIR=\$(ls -td ${REMOTE_DIR}-backup-* 2>/dev/null | head -1)

if [[ -z "\$BACKUP_DIR" ]]; then
    echo "❌ Žiadny backup nenájdený"
    exit 1
fi

echo "🔄 Rollback na: \$BACKUP_DIR"

# Zastavenie aktuálnych služieb
cd "$REMOTE_DIR"
docker-compose down || true

# Rollback
cd /home/ubuntu
mv "$REMOTE_DIR" "${REMOTE_DIR}-failed-\$(date +%Y%m%d_%H%M%S)"
mv "\$BACKUP_DIR" "$REMOTE_DIR"

# Spustenie služieb
cd "$REMOTE_DIR"
docker-compose up -d

echo "✅ Rollback dokončený"
EOF

    success "Rollback dokončený"
}

# ============================================================================
# SPUSTENIE SCRIPTU
# ============================================================================

# Kontrola argumentov
case "${1:-}" in
    "quick")
        quick_deploy
        ;;
    "code-only")
        code_only_deploy
        ;;
    "rollback")
        rollback
        ;;
    "help"|"-h"|"--help")
        echo "Universal Oracle Voice Chat Backend Deployment Script"
        echo ""
        echo "Použitie:"
        echo "  $0                 # Štandardný deployment s potvrdením"
        echo "  $0 quick           # Rýchly deployment bez potvrdenia"
        echo "  $0 code-only       # Deployment len kódu (bez systémových závislostí)"
        echo "  $0 rollback        # Rollback na predchádzajúcu verziu"
        echo "  $0 help            # Zobrazenie tejto nápovedy"
        echo ""
        echo "Environment variables:"
        echo "  SERVER_IP          # IP adresa servera (default: 129.159.9.170)"
        echo "  SSH_KEY            # Cesta k SSH kľúču"
        echo "  SSH_USER           # SSH používateľ (default: ubuntu)"
        echo "  DEEPGRAM_API_KEY   # Deepgram API kľúč"
        echo "  OPENAI_API_KEY     # OpenAI API kľúč"
        echo "  TTS_VOICE          # TTS voice model (default: sk_SK-lili-medium)"
        echo ""
        ;;
    *)
        main
        ;;
esac
