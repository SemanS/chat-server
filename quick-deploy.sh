#!/bin/bash

# Quick Deploy Script for Oracle Voice Chat Backend with Piper TTS Server
# Rýchly deployment script s Piper TTS serverom

set -euo pipefail

# Farby
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Oracle Voice Chat Backend - Quick Deploy with Piper TTS${NC}"
echo "=========================================================="

# Kontrola, či existuje deploy.env
if [[ -f "deploy.env" ]]; then
    echo -e "${GREEN}📋 Načítavam konfiguráciu z deploy.env...${NC}"
    source deploy.env
else
    echo -e "${YELLOW}⚠️  deploy.env nenájdený, používam prednastavené hodnoty${NC}"
    
    # Prednastavené hodnoty
    export SERVER_IP="${SERVER_IP:-129.159.9.170}"
    export SSH_KEY="${SSH_KEY:-/Users/hotovo/Documents/augment-projects/chat/ssh-key-2025-07-16 (3).key}"
    export SSH_USER="${SSH_USER:-ubuntu}"
    export REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/chat-server}"
    export TTS_VOICE="${TTS_VOICE:-sk_SK-lili-medium}"
fi

# Kontrola API kľúčov
if [[ -z "${DEEPGRAM_API_KEY:-}" ]] || [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo -e "${RED}❌ CHYBA: API kľúče nie sú nastavené!${NC}"
    echo ""
    echo "Nastav API kľúče jedným z týchto spôsobov:"
    echo ""
    echo "1. Vytvor deploy.env súbor:"
    echo "   cp deploy.env.example deploy.env"
    echo "   # Uprav hodnoty v deploy.env"
    echo "   source deploy.env"
    echo ""
    echo "2. Alebo nastav environment variables:"
    echo "   export DEEPGRAM_API_KEY='your-deepgram-key'"
    echo "   export OPENAI_API_KEY='your-openai-key'"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Konfigurácia OK, spúšťam deployment s Piper TTS...${NC}"
echo ""

# Najprv nastavenie Piper TTS servera lokálne
echo -e "${BLUE}🔊 Nastavujem Piper TTS server lokálne...${NC}"
if [[ -f "./setup-piper-tts-web.sh" ]]; then
    ./setup-piper-tts-web.sh
    echo -e "${GREEN}✅ Piper TTS server nastavený${NC}"
else
    echo -e "${YELLOW}⚠️  setup-piper-tts-web.sh nenájdený, preskakujem lokálne nastavenie${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Spúšťam deployment na server...${NC}"

# Spustenie universal deployment scriptu
./deploy-universal.sh quick
