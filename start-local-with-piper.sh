#!/bin/bash

# Start Local Development with Piper TTS Server
# Spustenie lokálneho vývoja s Piper TTS serverom

set -euo pipefail

# Farby
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🚀 Oracle Voice Chat Backend - Local Development with Piper TTS${NC}"
echo "================================================================"

# Kontrola prerekvizít
check_prerequisites() {
    echo -e "${BLUE}🔍 Kontrolujem prerekvizity...${NC}"
    
    # Kontrola Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js nie je nainštalovaný${NC}"
        exit 1
    fi
    
    # Kontrola npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm nie je nainštalovaný${NC}"
        exit 1
    fi
    
    # Kontrola Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker nie je nainštalovaný${NC}"
        exit 1
    fi
    
    # Kontrola package.json
    if [[ ! -f "package.json" ]]; then
        echo -e "${RED}❌ package.json nenájdený${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerekvizity v poriadku${NC}"
}

# Inštalácia závislostí
install_dependencies() {
    echo -e "${BLUE}📦 Inštalujem závislosti...${NC}"
    
    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
        npm install
        echo -e "${GREEN}✅ Závislosti nainštalované${NC}"
    else
        echo -e "${CYAN}ℹ️  Závislosti už sú nainštalované${NC}"
    fi
}

# Nastavenie Piper TTS servera
setup_piper_tts() {
    echo -e "${BLUE}🔊 Nastavujem Piper TTS server...${NC}"
    
    if [[ -f "./setup-piper-tts-web.sh" ]]; then
        ./setup-piper-tts-web.sh
        echo -e "${GREEN}✅ Piper TTS server nastavený${NC}"
    else
        echo -e "${YELLOW}⚠️  setup-piper-tts-web.sh nenájdený${NC}"
        echo -e "${CYAN}ℹ️  Vytváram základné nastavenie...${NC}"
        
        # Základné nastavenie bez skriptu
        if ! docker ps | grep -q "piper-tts-server"; then
            echo -e "${BLUE}🐳 Spúšťam Piper TTS server...${NC}"
            
            # Vytvorenie adresára pre hlasy
            mkdir -p piper-data
            
            # Stiahnutie slovenského hlasu ak neexistuje
            if [[ ! -f "piper-data/sk_SK-lili-medium.onnx" ]]; then
                echo -e "${BLUE}📥 Sťahujem slovenský hlas...${NC}"
                curl -L -o piper-data/sk_SK-lili-medium.onnx \
                    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx"
                curl -L -o piper-data/sk_SK-lili-medium.onnx.json \
                    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx.json"
            fi
            
            # Spustenie Piper TTS servera
            docker run -d \
                --name piper-tts-server \
                -p 5000:5000 \
                -v "$(pwd)/piper-data:/data" \
                rhasspy/wyoming-piper:latest \
                --voice sk_SK-lili-medium \
                --http-port 5000
            
            echo -e "${GREEN}✅ Piper TTS server spustený${NC}"
        else
            echo -e "${CYAN}ℹ️  Piper TTS server už beží${NC}"
        fi
    fi
}

# Aktualizácia .env súboru pre lokálny vývoj
setup_local_env() {
    echo -e "${BLUE}⚙️  Nastavujem lokálne environment...${NC}"
    
    # Záloha existujúceho .env
    if [[ -f ".env" ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo -e "${CYAN}ℹ️  Vytvorená záloha .env súboru${NC}"
    fi
    
    # Vytvorenie/aktualizácia .env pre lokálny vývoj
    cat > .env << 'EOF'
# Oracle Voice Chat Backend - Local Development
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
TZ=Europe/Bratislava

# API Keys (nastav svoje kľúče)
DEEPGRAM_API_KEY=your-deepgram-key-here
OPENAI_API_KEY=your-openai-key-here

# OpenAI Configuration
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
OPENAI_SYSTEM_PROMPT=Si užitočný AI asistent. Odpovedaj v slovenčine, buď stručný a priateľský. Ak dostaneš otázku v inom jazyku, odpovedaj v tom istom jazyku.

# Redis Configuration (disabled for local dev)
USE_REDIS=false

# CORS Configuration (permissive for local dev)
ALLOWED_ORIGINS=*

# TTS Configuration - Remote Piper TTS Server
PIPER_TTS_URL=http://localhost:5000
TTS_VOICE=sk_SK-lili-medium
TTS_CACHE_ENABLED=true

# Rate Limiting (relaxed for local dev)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=debug

# Session Configuration
SESSION_SECRET=local-development-secret
SESSION_MAX_AGE=86400000

# Development flags
MOCK_SERVICES=false
DEBUG=voice-chat:*
EOF
    
    echo -e "${GREEN}✅ Lokálne environment nastavené${NC}"
    echo -e "${YELLOW}⚠️  Nezabudni nastaviť svoje API kľúče v .env súbore!${NC}"
}

# Test Piper TTS servera
test_piper_tts() {
    echo -e "${BLUE}🧪 Testujem Piper TTS server...${NC}"
    
    # Čakanie na spustenie
    sleep 5
    
    # Test HTTP API
    if curl -s -f "http://localhost:5000" > /dev/null; then
        echo -e "${GREEN}✅ Piper TTS server je dostupný${NC}"
        
        # Test generovania reči
        if curl -s -X POST \
            -H "Content-Type: application/json" \
            -d '{"text":"Test lokálneho Piper TTS servera", "voice":"sk_SK-lili-medium"}' \
            "http://localhost:5000/api/tts" \
            --output /tmp/test-local.wav && [[ -f "/tmp/test-local.wav" ]]; then
            
            echo -e "${GREEN}✅ Generovanie reči funguje${NC}"
            rm -f /tmp/test-local.wav
        else
            echo -e "${YELLOW}⚠️  Generovanie reči nefunguje správne${NC}"
        fi
    else
        echo -e "${RED}❌ Piper TTS server nie je dostupný${NC}"
        echo -e "${CYAN}ℹ️  Skontroluj logy: docker logs piper-tts-server${NC}"
    fi
}

# Spustenie aplikácie
start_application() {
    echo -e "${BLUE}🚀 Spúšťam aplikáciu...${NC}"
    
    # Kontrola či už beží
    if lsof -i :3000 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port 3000 je už obsadený${NC}"
        echo -e "${CYAN}ℹ️  Zastavujem existujúci proces...${NC}"
        pkill -f "node.*server.js" || true
        sleep 2
    fi
    
    echo -e "${GREEN}🎉 Aplikácia sa spúšťa...${NC}"
    echo -e "${CYAN}ℹ️  Dostupná na: http://localhost:3000${NC}"
    echo -e "${CYAN}ℹ️  Pre zastavenie stlač Ctrl+C${NC}"
    echo ""
    
    # Spustenie v development móde
    npm run dev
}

# Zobrazenie inštrukcií
show_instructions() {
    echo ""
    echo -e "${GREEN}🎉 LOKÁLNY VÝVOJ S PIPER TTS NASTAVENÝ!${NC}"
    echo "======================================="
    echo ""
    echo -e "${CYAN}🌐 Služby sú dostupné na:${NC}"
    echo "   Aplikácia:     http://localhost:3000"
    echo "   Piper TTS:     http://localhost:5000"
    echo "   Health check:  http://localhost:3000/health"
    echo "   TTS status:    http://localhost:3000/api/tts/status"
    echo ""
    echo -e "${CYAN}🧪 Testovanie TTS:${NC}"
    echo "   curl -X POST -H 'Content-Type: application/json' \\"
    echo "        -d '{\"text\":\"Test TTS\"}' \\"
    echo "        http://localhost:3000/api/tts/synthesize --output test.wav"
    echo ""
    echo -e "${CYAN}🔧 Správa Piper TTS servera:${NC}"
    echo "   docker ps | grep piper-tts-server"
    echo "   docker logs piper-tts-server"
    echo "   docker restart piper-tts-server"
    echo "   docker stop piper-tts-server"
    echo ""
    echo -e "${YELLOW}📋 Ďalšie kroky:${NC}"
    echo "   1. Nastav API kľúče v .env súbore"
    echo "   2. Reštartuj aplikáciu: npm run dev"
    echo "   3. Otestuj voice chat funkcionalitu"
    echo ""
}

# Cleanup funkcia
cleanup() {
    echo -e "${BLUE}🧹 Čistím...${NC}"
    # Cleanup sa vykoná automaticky pri ukončení
}

# Hlavná funkcia
main() {
    # Trap pre cleanup
    trap cleanup EXIT
    
    check_prerequisites
    install_dependencies
    setup_piper_tts
    setup_local_env
    test_piper_tts
    show_instructions
    
    # Spýtaj sa či spustiť aplikáciu
    echo -e "${YELLOW}Chceš spustiť aplikáciu teraz? (y/N):${NC} "
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_application
    else
        echo -e "${CYAN}ℹ️  Pre spustenie aplikácie použij: npm run dev${NC}"
    fi
}

# Kontrola argumentov
case "${1:-}" in
    "start")
        main
        ;;
    "setup-only")
        check_prerequisites
        install_dependencies
        setup_piper_tts
        setup_local_env
        test_piper_tts
        show_instructions
        ;;
    "help"|"-h"|"--help")
        echo "Local Development with Piper TTS Server"
        echo ""
        echo "Použitie:"
        echo "  $0                 # Kompletné nastavenie a spustenie"
        echo "  $0 start           # Kompletné nastavenie a spustenie"
        echo "  $0 setup-only      # Len nastavenie bez spustenia aplikácie"
        echo "  $0 help            # Zobrazenie tejto nápovedy"
        echo ""
        ;;
    *)
        main
        ;;
esac
