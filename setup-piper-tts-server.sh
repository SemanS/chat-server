#!/bin/bash

# Piper TTS Server Setup Script
# Nastavenie samostatného Piper TTS servera pomocou Docker kontajnera

echo "🐳 Piper TTS Server Setup Script"
echo "================================="

# Farby pre výstup
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funkcie pre farebný výstup
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Kontrola Docker inštalácie
check_docker() {
    log_info "Kontrolujem Docker inštaláciu..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker nie je nainštalovaný!"
        log_info "Inštalácia Docker:"
        log_info "Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io"
        log_info "CentOS/RHEL: sudo yum install docker"
        log_info "macOS: brew install docker"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon nie je spustený!"
        log_info "Spusti Docker: sudo systemctl start docker"
        exit 1
    fi
    
    log_success "Docker je dostupný"
}

# Vytvorenie adresára pre hlasové modely
setup_voices_directory() {
    log_info "Nastavujem adresár pre hlasové modely..."
    
    VOICES_DIR="$HOME/piper-data"
    
    if [[ ! -d "$VOICES_DIR" ]]; then
        mkdir -p "$VOICES_DIR"
        log_success "Vytvorený adresár: $VOICES_DIR"
    else
        log_info "Adresár už existuje: $VOICES_DIR"
    fi
    
    # Kontrola slovenského hlasu
    SLOVAK_VOICE="$VOICES_DIR/sk_SK-lili-medium.onnx"
    SLOVAK_CONFIG="$VOICES_DIR/sk_SK-lili-medium.onnx.json"
    
    if [[ ! -f "$SLOVAK_VOICE" ]] || [[ ! -f "$SLOVAK_CONFIG" ]]; then
        log_warning "Slovenský hlas nie je nájdený"
        log_info "Sťahujem slovenský hlas sk_SK-lili-medium..."
        
        # Stiahnutie hlasového modelu
        curl -L -o "$SLOVAK_VOICE" "https://huggingface.co/rhasspy/piper-voices/resolve/main/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx"
        curl -L -o "$SLOVAK_CONFIG" "https://huggingface.co/rhasspy/piper-voices/resolve/main/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx.json"
        
        if [[ -f "$SLOVAK_VOICE" ]] && [[ -f "$SLOVAK_CONFIG" ]]; then
            log_success "Slovenský hlas úspešne stiahnutý"
        else
            log_error "Nepodarilo sa stiahnuť slovenský hlas"
            log_info "Manuálne stiahnutie z: https://huggingface.co/rhasspy/piper-voices/tree/main/sk/sk_SK/lili/medium"
        fi
    else
        log_success "Slovenský hlas je dostupný"
    fi
    
    echo "VOICES_DIR=$VOICES_DIR"
}

# Spustenie Wyoming Piper kontajnera (oficiálny)
start_wyoming_piper() {
    log_info "Spúšťam Wyoming Piper TTS server..."
    
    # Zastavenie existujúceho kontajnera
    if docker ps -a | grep -q "piper-tts-server"; then
        log_info "Zastavujem existujúci kontajner..."
        docker stop piper-tts-server 2>/dev/null
        docker rm piper-tts-server 2>/dev/null
    fi
    
    # Spustenie nového kontajnera
    docker run -d \
        --name piper-tts-server \
        -p 5000:5000 \
        -p 10200:10200 \
        -v "$VOICES_DIR:/data" \
        rhasspy/wyoming-piper \
        --voice sk_SK-lili-medium \
        --http-port 5000
    
    if [[ $? -eq 0 ]]; then
        log_success "Wyoming Piper server spustený"
        log_info "HTTP API: http://localhost:5000"
        log_info "Wyoming protokol: localhost:10200"
    else
        log_error "Nepodarilo sa spustiť Wyoming Piper server"
        return 1
    fi
}

# Spustenie alternatívneho Piper servera
start_alternative_piper() {
    log_info "Spúšťam alternatívny Piper TTS server..."
    
    # Zastavenie existujúceho kontajnera
    if docker ps -a | grep -q "piper-tts-simple"; then
        log_info "Zastavujem existujúci kontajner..."
        docker stop piper-tts-simple 2>/dev/null
        docker rm piper-tts-simple 2>/dev/null
    fi
    
    # Spustenie alternatívneho kontajnera
    docker run -d \
        --name piper-tts-simple \
        -p 5001:5000 \
        waveoffire/piper-tts-server:latest
    
    if [[ $? -eq 0 ]]; then
        log_success "Alternatívny Piper server spustený"
        log_info "HTTP API: http://localhost:5001"
    else
        log_error "Nepodarilo sa spustiť alternatívny Piper server"
        return 1
    fi
}

# Test TTS servera
test_tts_server() {
    local port=${1:-5000}
    log_info "Testujem TTS server na porte $port..."
    
    # Počkaj na spustenie servera
    sleep 5
    
    # Test jednoduchého POST požiadavku
    local test_text="Ahoj, toto je test TTS servera."
    local output_file="/tmp/tts-test-$(date +%s).wav"
    
    if curl -X POST \
        -H "Content-Type: text/plain" \
        -d "$test_text" \
        "http://localhost:$port" \
        --output "$output_file" \
        --silent \
        --max-time 30; then
        
        if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
            local size=$(du -h "$output_file" | cut -f1)
            log_success "TTS test úspešný: $output_file ($size)"
            rm -f "$output_file"
            return 0
        else
            log_error "TTS test zlyhal - prázdny súbor"
            return 1
        fi
    else
        log_error "TTS test zlyhal - server neodpovedá"
        return 1
    fi
}

# Aktualizácia .env súboru
update_env_file() {
    local port=${1:-5000}
    log_info "Aktualizujem .env súbor..."
    
    local env_file=".env"
    local tts_url="http://localhost:$port"
    
    if [[ -f "$env_file" ]]; then
        # Odstráň existujúci PIPER_TTS_URL ak existuje
        sed -i.bak '/^PIPER_TTS_URL=/d' "$env_file"
        sed -i.bak '/^# PIPER_TTS_URL=/d' "$env_file"
        
        # Pridaj nový PIPER_TTS_URL
        echo "PIPER_TTS_URL=$tts_url" >> "$env_file"
        
        log_success "Aktualizovaný .env súbor s PIPER_TTS_URL=$tts_url"
    else
        log_warning ".env súbor neexistuje"
        log_info "Vytváram .env súbor..."
        echo "PIPER_TTS_URL=$tts_url" > "$env_file"
        log_success "Vytvorený .env súbor"
    fi
}

# Zobrazenie stavu
show_status() {
    echo
    log_info "📊 Stav Piper TTS serverov:"
    
    if docker ps | grep -q "piper-tts-server"; then
        log_success "Wyoming Piper server beží na porte 5000"
        echo "  - HTTP API: http://localhost:5000"
        echo "  - Wyoming protokol: localhost:10200"
    fi
    
    if docker ps | grep -q "piper-tts-simple"; then
        log_success "Alternatívny Piper server beží na porte 5001"
        echo "  - HTTP API: http://localhost:5001"
    fi
    
    echo
    log_info "🔧 Ďalšie kroky:"
    echo "1. Reštartuj aplikáciu: pm2 restart voice-chat"
    echo "2. Otestuj TTS endpoint: curl -X POST -H 'Content-Type: application/json' -d '{\"text\":\"test\"}' http://localhost:3000/api/tts/synthesize"
    echo "3. Skontroluj status: curl http://localhost:3000/api/tts/status"
}

# Hlavná funkcia
main() {
    local server_type=${1:-"wyoming"}
    
    check_docker
    setup_voices_directory
    
    case "$server_type" in
        "wyoming"|"official")
            if start_wyoming_piper && test_tts_server 5000; then
                update_env_file 5000
            else
                log_error "Wyoming Piper server sa nepodarilo spustiť"
                exit 1
            fi
            ;;
        "alternative"|"simple")
            if start_alternative_piper && test_tts_server 5001; then
                update_env_file 5001
            else
                log_error "Alternatívny Piper server sa nepodarilo spustiť"
                exit 1
            fi
            ;;
        "both")
            start_wyoming_piper
            start_alternative_piper
            if test_tts_server 5000; then
                update_env_file 5000
            elif test_tts_server 5001; then
                update_env_file 5001
            else
                log_error "Žiadny TTS server nefunguje"
                exit 1
            fi
            ;;
        *)
            log_error "Neznámy typ servera: $server_type"
            log_info "Použitie: $0 [wyoming|alternative|both]"
            exit 1
            ;;
    esac
    
    show_status
    log_success "Setup dokončený!"
}

# Spusti setup
main "$@"
