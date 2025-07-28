#!/bin/bash

# Piper TTS Web Server Setup Script
# Rýchle nastavenie Piper TTS servera pre webové rozhranie

set -euo pipefail

# Konfigurácia
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

# Utility funkcie
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

# Kontrola Docker inštalácie
check_docker() {
    step "Kontrolujem Docker inštaláciu..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker nie je nainštalovaný!"
        info "Inštalácia Docker:"
        info "Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io"
        info "macOS: brew install docker"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon nie je spustený!"
        info "Spustenie Docker: sudo systemctl start docker"
        exit 1
    fi
    
    success "Docker je dostupný"
}

# Vytvorenie adresára pre hlasové modely
setup_voices_directory() {
    step "Nastavujem adresár pre hlasové modely..."
    
    VOICES_DIR="./piper-data"
    
    if [[ ! -d "$VOICES_DIR" ]]; then
        mkdir -p "$VOICES_DIR"
        success "Vytvorený adresár: $VOICES_DIR"
    else
        info "Adresár už existuje: $VOICES_DIR"
    fi
    
    # Kontrola slovenského hlasu
    SLOVAK_VOICE="$VOICES_DIR/$TTS_VOICE.onnx"
    SLOVAK_CONFIG="$VOICES_DIR/$TTS_VOICE.onnx.json"
    
    if [[ ! -f "$SLOVAK_VOICE" ]] || [[ ! -f "$SLOVAK_CONFIG" ]]; then
        warning "Slovenský hlas nie je nájdený"
        info "Sťahujem slovenský hlas $TTS_VOICE..."
        
        # Stiahnutie hlasového modelu
        curl -L -o "$SLOVAK_VOICE" "$PIPER_VOICES_URL"
        curl -L -o "$SLOVAK_CONFIG" "$PIPER_VOICES_JSON_URL"
        
        if [[ -f "$SLOVAK_VOICE" ]] && [[ -f "$SLOVAK_CONFIG" ]]; then
            success "Slovenský hlas úspešne stiahnutý"
        else
            error "Nepodarilo sa stiahnuť slovenský hlas"
            info "Manuálne stiahnutie z: https://huggingface.co/rhasspy/piper-voices/tree/main/sk/sk_SK/lili/medium"
            exit 1
        fi
    else
        success "Slovenský hlas je dostupný"
    fi
}

# Vytvorenie Docker Compose súboru
create_docker_compose() {
    step "Vytváram Docker Compose súbor..."
    
    cat > docker-compose.piper-tts.yml << EOF
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
    name: voice-chat-network
EOF
    
    success "Docker Compose súbor vytvorený: docker-compose.piper-tts.yml"
}

# Vytvorenie Docker network
create_docker_network() {
    step "Vytváram Docker network..."
    
    if ! docker network ls | grep -q "voice-chat-network"; then
        docker network create voice-chat-network
        success "Docker network vytvorená: voice-chat-network"
    else
        info "Docker network už existuje: voice-chat-network"
    fi
}

# Spustenie Piper TTS servera
start_piper_tts_server() {
    step "Spúšťam Piper TTS server..."
    
    # Zastavenie existujúceho kontajnera
    if docker ps -a | grep -q "piper-tts-server"; then
        info "Zastavujem existujúci kontajner..."
        docker stop piper-tts-server 2>/dev/null || true
        docker rm piper-tts-server 2>/dev/null || true
    fi
    
    # Spustenie nového kontajnera
    docker-compose -f docker-compose.piper-tts.yml up -d
    
    if [[ $? -eq 0 ]]; then
        success "Piper TTS server spustený"
    else
        error "Nepodarilo sa spustiť Piper TTS server"
        exit 1
    fi
}

# Aktualizácia .env súboru
update_env_file() {
    step "Aktualizujem .env súbor..."
    
    if [[ -f ".env" ]]; then
        # Záloha pôvodného .env súboru
        cp .env .env.backup
        info "Vytvorená záloha pôvodného .env súboru: .env.backup"
        
        # Odstránenie existujúcich TTS nastavení
        sed -i.bak '/^PIPER_TTS_URL=/d' .env
        sed -i.bak '/^# PIPER_TTS_URL=/d' .env
        sed -i.bak '/^PIPER_PATH=/d' .env
        sed -i.bak '/^PIPER_VOICES_PATH=/d' .env
        
        # Pridanie nových TTS nastavení
        echo "" >> .env
        echo "# TTS Configuration - Remote Piper TTS Server" >> .env
        echo "PIPER_TTS_URL=http://piper-tts-server:5000" >> .env
        echo "TTS_VOICE=$TTS_VOICE" >> .env
        echo "TTS_CACHE_ENABLED=true" >> .env
        echo "# Fallback local Piper (disabled)" >> .env
        echo "# PIPER_PATH=/usr/local/bin/piper" >> .env
        echo "# PIPER_VOICES_PATH=/app/voices" >> .env
        
        success "Aktualizovaný .env súbor s PIPER_TTS_URL=http://piper-tts-server:5000"
    else
        warning ".env súbor neexistuje"
        info "Vytváram nový .env súbor..."
        
        cat > .env << EOF
# Oracle Voice Chat Backend - Environment
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
TZ=Europe/Bratislava

# TTS Configuration - Remote Piper TTS Server
PIPER_TTS_URL=http://piper-tts-server:5000
TTS_VOICE=$TTS_VOICE
TTS_CACHE_ENABLED=true
# Fallback local Piper (disabled)
# PIPER_PATH=/usr/local/bin/piper
# PIPER_VOICES_PATH=/app/voices
EOF
        
        success "Vytvorený nový .env súbor"
    fi
}

# Test Piper TTS servera
test_piper_tts_server() {
    step "Testujem Piper TTS server..."
    
    # Čakanie na spustenie servera
    info "Čakám na spustenie servera..."
    sleep 10
    
    # Test HTTP API
    info "Testujem HTTP API..."
    if curl -s -f "http://localhost:$PIPER_TTS_PORT" > /dev/null; then
        success "HTTP API je dostupné"
    else
        warning "HTTP API nie je dostupné, čakám ďalších 20 sekúnd..."
        sleep 20
        if curl -s -f "http://localhost:$PIPER_TTS_PORT" > /dev/null; then
            success "HTTP API je dostupné po dodatočnom čakaní"
        else
            error "HTTP API nie je dostupné"
            info "Skontroluj logy: docker logs piper-tts-server"
            exit 1
        fi
    fi
    
    # Test generovania reči
    info "Testujem generovanie reči..."
    if curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"Test Piper TTS servera\", \"voice\":\"$TTS_VOICE\"}" \
        "http://localhost:$PIPER_TTS_PORT/api/tts" \
        --output /tmp/test.wav && [[ -f "/tmp/test.wav" ]]; then
        
        success "Generovanie reči funguje"
        rm -f /tmp/test.wav
    else
        error "Generovanie reči nefunguje"
        info "Skontroluj logy: docker logs piper-tts-server"
        exit 1
    fi
}

# Reštart aplikácie
restart_application() {
    step "Reštartujem aplikáciu..."
    
    if command -v pm2 &> /dev/null && pm2 list | grep -q "voice-chat"; then
        info "Reštartujem PM2 službu..."
        pm2 restart voice-chat
        success "Aplikácia reštartovaná"
    elif [[ -f "docker-compose.yml" ]]; then
        info "Reštartujem Docker kontajnery..."
        docker-compose restart
        success "Docker kontajnery reštartované"
    else
        warning "Nemôžem automaticky reštartovať aplikáciu"
        info "Reštartuj aplikáciu manuálne"
    fi
}

# Zobrazenie inštrukcií
show_instructions() {
    echo ""
    echo -e "${GREEN}🎉 PIPER TTS SERVER ÚSPEŠNE NASTAVENÝ!${NC}"
    echo "=============================================="
    echo ""
    echo -e "${CYAN}🌐 Piper TTS Server je dostupný na:${NC}"
    echo "   HTTP API:    http://localhost:$PIPER_TTS_PORT"
    echo "   Wyoming:     localhost:10200"
    echo ""
    echo -e "${CYAN}🔧 Správa servera:${NC}"
    echo "   docker-compose -f docker-compose.piper-tts.yml ps"
    echo "   docker-compose -f docker-compose.piper-tts.yml logs -f"
    echo "   docker-compose -f docker-compose.piper-tts.yml restart"
    echo "   docker-compose -f docker-compose.piper-tts.yml down"
    echo ""
    echo -e "${CYAN}🧪 Testovanie:${NC}"
    echo "   curl -X POST -H \"Content-Type: application/json\" \\"
    echo "        -d '{\"text\":\"Test Piper TTS servera\", \"voice\":\"$TTS_VOICE\"}' \\"
    echo "        http://localhost:$PIPER_TTS_PORT/api/tts --output test.wav"
    echo ""
    echo -e "${YELLOW}📋 Ďalšie kroky:${NC}"
    echo "   1. Reštartuj aplikáciu ak ešte nebola reštartovaná"
    echo "   2. Otestuj TTS endpoint: curl -X POST -H 'Content-Type: application/json' -d '{\"text\":\"test\"}' http://localhost:3000/api/tts/synthesize"
    echo "   3. Skontroluj status: curl http://localhost:3000/api/tts/status"
    echo ""
}

# Hlavná funkcia
main() {
    echo -e "${GREEN}🚀 PIPER TTS WEB SERVER SETUP${NC}"
    echo "============================="
    echo ""
    
    check_docker
    setup_voices_directory
    create_docker_compose
    create_docker_network
    start_piper_tts_server
    update_env_file
    test_piper_tts_server
    restart_application
    show_instructions
    
    success "Setup dokončený!"
}

# Spustenie scriptu
main "$@"
