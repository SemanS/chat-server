#!/bin/bash

# Quick Deploy Script for Oracle Voice Chat Backend
# Rýchly deployment script s prednastavenými hodnotami

set -euo pipefail

# Farby
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Oracle Voice Chat Backend - Quick Deploy${NC}"
echo "=============================================="

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
echo -e "${GREEN}✅ Konfigurácia OK, spúšťam deployment...${NC}"
echo ""

# Spustenie universal deployment scriptu
./deploy-universal.sh quick
