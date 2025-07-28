#!/bin/bash

# Test script pre Piper TTS deployment
# Overuje, že všetko funguje správne

set -euo pipefail

# Farby
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Konfigurácia
APP_URL="${APP_URL:-http://localhost:3000}"
PIPER_URL="${PIPER_URL:-http://localhost:5000}"

echo -e "${GREEN}🧪 PIPER TTS DEPLOYMENT TEST${NC}"
echo "============================="

# Test funkcie
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing $name... "
    
    if response=$(curl -s -w "%{http_code}" -o /tmp/test_response "$url"); then
        if [[ "$response" == "$expected_status" ]]; then
            echo -e "${GREEN}✅ OK${NC}"
            return 0
        else
            echo -e "${RED}❌ FAIL (HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ FAIL (Connection error)${NC}"
        return 1
    fi
}

# Test JSON endpoint
test_json_endpoint() {
    local name="$1"
    local url="$2"
    local expected_field="$3"
    
    echo -n "Testing $name... "
    
    if response=$(curl -s "$url"); then
        if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ OK${NC}"
            echo -e "${CYAN}   Response: $(echo "$response" | jq -c ".$expected_field")${NC}"
            return 0
        else
            echo -e "${RED}❌ FAIL (Missing field: $expected_field)${NC}"
            echo -e "${CYAN}   Response: $response${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ FAIL (Connection error)${NC}"
        return 1
    fi
}

# Test TTS generation
test_tts_generation() {
    local name="$1"
    local url="$2"
    local data="$3"
    
    echo -n "Testing $name... "
    
    if curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$url" \
        --output /tmp/test_audio.wav; then
        
        if [[ -f "/tmp/test_audio.wav" ]] && [[ -s "/tmp/test_audio.wav" ]]; then
            local size=$(stat -f%z "/tmp/test_audio.wav" 2>/dev/null || stat -c%s "/tmp/test_audio.wav" 2>/dev/null || echo "unknown")
            echo -e "${GREEN}✅ OK (${size} bytes)${NC}"
            rm -f /tmp/test_audio.wav
            return 0
        else
            echo -e "${RED}❌ FAIL (Empty or missing audio file)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ FAIL (Request failed)${NC}"
        return 1
    fi
}

# Hlavné testy
main() {
    local failed_tests=0
    local total_tests=0
    
    echo -e "${BLUE}🔍 Základné testy dostupnosti...${NC}"
    
    # Test základných endpointov
    ((total_tests++))
    test_endpoint "App Health Check" "$APP_URL/health" || ((failed_tests++))
    
    ((total_tests++))
    test_endpoint "Piper TTS Server" "$PIPER_URL" || ((failed_tests++))
    
    echo ""
    echo -e "${BLUE}📊 Testy API endpointov...${NC}"
    
    # Test TTS status
    ((total_tests++))
    test_json_endpoint "TTS Status" "$APP_URL/api/tts/status" "status" || ((failed_tests++))
    
    # Test TTS voices
    ((total_tests++))
    test_json_endpoint "TTS Voices" "$APP_URL/api/tts/voices" "voices" || ((failed_tests++))
    
    echo ""
    echo -e "${BLUE}🔊 Testy TTS generovania...${NC}"
    
    # Test Piper TTS Server priamo
    ((total_tests++))
    test_tts_generation "Piper TTS Server Direct" "$PIPER_URL/api/tts" \
        '{"text":"Test Piper TTS servera", "voice":"sk_SK-lili-medium"}' || ((failed_tests++))
    
    # Test aplikačného TTS API
    ((total_tests++))
    test_tts_generation "App TTS API" "$APP_URL/api/tts/synthesize" \
        '{"text":"Test aplikačného TTS API"}' || ((failed_tests++))
    
    echo ""
    echo -e "${BLUE}🐳 Testy Docker kontajnerov...${NC}"
    
    # Test Docker kontajnerov
    echo -n "Testing Piper TTS Container... "
    if docker ps | grep -q "piper-tts-server"; then
        echo -e "${GREEN}✅ OK (Running)${NC}"
    else
        echo -e "${RED}❌ FAIL (Not running)${NC}"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    echo -n "Testing App Container... "
    if docker ps | grep -q "oracle-voice-chat-backend" || pgrep -f "node.*server.js" > /dev/null; then
        echo -e "${GREEN}✅ OK (Running)${NC}"
    else
        echo -e "${RED}❌ FAIL (Not running)${NC}"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    echo ""
    echo -e "${BLUE}📁 Testy súborov a konfigurácie...${NC}"
    
    # Test hlasových modelov
    echo -n "Testing Voice Models... "
    if [[ -f "piper-data/sk_SK-lili-medium.onnx" ]] && [[ -f "piper-data/sk_SK-lili-medium.onnx.json" ]]; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL (Missing voice models)${NC}"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    # Test .env súboru
    echo -n "Testing Environment Config... "
    if [[ -f ".env" ]] && grep -q "PIPER_TTS_URL" .env; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL (Missing or incomplete .env)${NC}"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    # Test Docker Compose súboru
    echo -n "Testing Docker Compose Config... "
    if [[ -f "docker-compose.piper-tts.yml" ]]; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL (Missing docker-compose.piper-tts.yml)${NC}"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    # Výsledky
    echo ""
    echo "=============================="
    if [[ $failed_tests -eq 0 ]]; then
        echo -e "${GREEN}🎉 VŠETKY TESTY ÚSPEŠNÉ!${NC}"
        echo -e "${GREEN}✅ $total_tests/$total_tests testov prešlo${NC}"
        echo ""
        echo -e "${CYAN}🚀 Piper TTS deployment je plne funkčný!${NC}"
        echo ""
        echo -e "${BLUE}📋 Dostupné služby:${NC}"
        echo "   Aplikácia:     $APP_URL"
        echo "   Piper TTS:     $PIPER_URL"
        echo "   Health check:  $APP_URL/health"
        echo "   TTS status:    $APP_URL/api/tts/status"
        echo ""
        exit 0
    else
        echo -e "${RED}❌ NIEKTORÉ TESTY ZLYHALI!${NC}"
        echo -e "${RED}❌ $failed_tests/$total_tests testov zlyhalo${NC}"
        echo ""
        echo -e "${YELLOW}🔧 Riešenie problémov:${NC}"
        echo "   1. Skontroluj logy: docker logs piper-tts-server"
        echo "   2. Skontroluj aplikáciu: docker-compose logs -f"
        echo "   3. Reštartuj služby: docker-compose restart"
        echo "   4. Skontroluj porty: netstat -tulpn | grep -E ':(3000|5000)'"
        echo ""
        exit 1
    fi
}

# Kontrola prerekvizít
check_prerequisites() {
    echo -e "${BLUE}🔍 Kontrolujem prerekvizity...${NC}"
    
    # Kontrola curl
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl nie je nainštalovaný${NC}"
        exit 1
    fi
    
    # Kontrola jq
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq nie je nainštalovaný, niektoré testy budú preskočené${NC}"
    fi
    
    # Kontrola docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ docker nie je nainštalovaný${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerekvizity v poriadku${NC}"
    echo ""
}

# Cleanup
cleanup() {
    rm -f /tmp/test_response /tmp/test_audio.wav
}

# Spustenie testov
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Piper TTS Deployment Test Script"
        echo ""
        echo "Použitie:"
        echo "  $0                 # Spustenie všetkých testov"
        echo "  $0 help            # Zobrazenie tejto nápovedy"
        echo ""
        echo "Environment variables:"
        echo "  APP_URL            # URL aplikácie (default: http://localhost:3000)"
        echo "  PIPER_URL          # URL Piper TTS servera (default: http://localhost:5000)"
        echo ""
        ;;
    *)
        trap cleanup EXIT
        check_prerequisites
        main
        ;;
esac
