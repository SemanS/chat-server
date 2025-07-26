#!/bin/bash

# TTS Setup Script
# Automatické nastavenie TTS environment variables a kontrola prerekvizít

echo "🔧 TTS Setup Script - Nastavenie Piper TTS"
echo "=========================================="

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

# Kontrola či sme na správnom serveri
check_server() {
    log_info "Kontrolujem server..."
    
    if [[ $(hostname -I | grep -c "129.159.9.170") -eq 0 ]]; then
        log_warning "Tento script je optimalizovaný pre Oracle server 129.159.9.170"
        log_warning "Môžeš pokračovať, ale možno budeš musieť upraviť cesty"
        read -p "Pokračovať? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "Bežím na Oracle serveri"
    fi
}

# Nastavenie environment variables
setup_environment() {
    log_info "Nastavujem environment variables..."
    
    # Definuj premenné
    PIPER_PATH="/usr/local/bin/piper"
    PIPER_VOICES_PATH="/app/voices"
    TTS_VOICE="sk_SK-lili-medium"
    TTS_CACHE_ENABLED="true"
    
    # Pridaj do ~/.profile ak tam nie sú
    if ! grep -q "PIPER_PATH" ~/.profile; then
        echo "export PIPER_PATH=$PIPER_PATH" >> ~/.profile
        log_success "Pridané PIPER_PATH do ~/.profile"
    else
        log_info "PIPER_PATH už existuje v ~/.profile"
    fi
    
    if ! grep -q "PIPER_VOICES_PATH" ~/.profile; then
        echo "export PIPER_VOICES_PATH=$PIPER_VOICES_PATH" >> ~/.profile
        log_success "Pridané PIPER_VOICES_PATH do ~/.profile"
    else
        log_info "PIPER_VOICES_PATH už existuje v ~/.profile"
    fi
    
    if ! grep -q "TTS_VOICE" ~/.profile; then
        echo "export TTS_VOICE=$TTS_VOICE" >> ~/.profile
        log_success "Pridané TTS_VOICE do ~/.profile"
    else
        log_info "TTS_VOICE už existuje v ~/.profile"
    fi
    
    if ! grep -q "TTS_CACHE_ENABLED" ~/.profile; then
        echo "export TTS_CACHE_ENABLED=$TTS_CACHE_ENABLED" >> ~/.profile
        log_success "Pridané TTS_CACHE_ENABLED do ~/.profile"
    else
        log_info "TTS_CACHE_ENABLED už existuje v ~/.profile"
    fi
    
    # Načítaj premenné do aktuálnej session
    export PIPER_PATH=$PIPER_PATH
    export PIPER_VOICES_PATH=$PIPER_VOICES_PATH
    export TTS_VOICE=$TTS_VOICE
    export TTS_CACHE_ENABLED=$TTS_CACHE_ENABLED
    
    log_success "Environment variables nastavené"
}

# Kontrola Piper binárky
check_piper_binary() {
    log_info "Kontrolujem Piper binárku..."
    
    if [[ -f "$PIPER_PATH" ]]; then
        log_success "Piper binárka existuje: $PIPER_PATH"
        
        # Test spustenia
        if $PIPER_PATH --help >/dev/null 2>&1; then
            log_success "Piper sa spúšťa správne"
        else
            log_error "Piper sa nespúšťa správne"
            return 1
        fi
    else
        log_error "Piper binárka neexistuje: $PIPER_PATH"
        log_info "Inštalácia Piper TTS:"
        log_info "1. Stiahnuť z: https://github.com/rhasspy/piper/releases"
        log_info "2. Rozbaliť a skopírovať do $PIPER_PATH"
        log_info "3. Nastaviť executable: chmod +x $PIPER_PATH"
        return 1
    fi
}

# Kontrola adresára pre hlasy
check_voices_directory() {
    log_info "Kontrolujem adresár pre hlasy..."
    
    if [[ -d "$PIPER_VOICES_PATH" ]]; then
        log_success "Adresár existuje: $PIPER_VOICES_PATH"
        
        # Zoznam dostupných hlasov
        local voices=$(find "$PIPER_VOICES_PATH" -name "*.onnx" -type f)
        if [[ -n "$voices" ]]; then
            log_success "Dostupné hlasy:"
            echo "$voices" | while read voice; do
                local size=$(du -h "$voice" | cut -f1)
                echo "  - $(basename "$voice") ($size)"
            done
        else
            log_warning "Žiadne .onnx súbory v $PIPER_VOICES_PATH"
        fi
    else
        log_warning "Adresár neexistuje: $PIPER_VOICES_PATH"
        log_info "Vytváram adresár..."
        mkdir -p "$PIPER_VOICES_PATH"
        log_success "Adresár vytvorený"
    fi
}

# Kontrola konkrétneho hlasu
check_voice_file() {
    log_info "Kontrolujem hlas: $TTS_VOICE"
    
    local voice_file="$PIPER_VOICES_PATH/${TTS_VOICE}.onnx"
    if [[ -f "$voice_file" ]]; then
        local size=$(du -h "$voice_file" | cut -f1)
        log_success "Hlas existuje: $voice_file ($size)"
    else
        log_error "Hlas neexistuje: $voice_file"
        log_info "Stiahnuť Slovak hlasy z:"
        log_info "https://huggingface.co/rhasspy/piper-voices/tree/main/sk/sk_SK"
        log_info "Potrebné súbory:"
        log_info "- sk_SK-lili-medium.onnx"
        log_info "- sk_SK-lili-medium.onnx.json"
        return 1
    fi
}

# Test TTS generovania
test_tts_generation() {
    log_info "Testujem TTS generovanie..."
    
    if [[ ! -f "$PIPER_PATH" ]] || [[ ! -f "$PIPER_VOICES_PATH/${TTS_VOICE}.onnx" ]]; then
        log_warning "Preskakujem test - chýbajú prerekvizity"
        return 1
    fi
    
    local test_text="Ahoj, toto je test TTS."
    local tmp_file="/tmp/tts-test-$(date +%s).wav"
    
    log_info "Generujem: \"$test_text\""
    
    if echo "$test_text" | $PIPER_PATH --model "$PIPER_VOICES_PATH/${TTS_VOICE}.onnx" --output_file "$tmp_file" 2>/dev/null; then
        if [[ -f "$tmp_file" ]]; then
            local size=$(du -h "$tmp_file" | cut -f1)
            log_success "TTS úspešne vygenerované: $tmp_file ($size)"
            rm -f "$tmp_file"
        else
            log_error "Výstupný súbor sa nevytvoril"
            return 1
        fi
    else
        log_error "TTS generovanie zlyhalo"
        return 1
    fi
}

# Reštart PM2 služby
restart_service() {
    log_info "Reštartujem PM2 službu..."
    
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 list | grep -q "voice-chat"; then
            pm2 restart voice-chat
            log_success "PM2 služba reštartovaná"
        else
            log_warning "PM2 služba 'voice-chat' nenájdená"
            log_info "Dostupné PM2 služby:"
            pm2 list
        fi
    else
        log_warning "PM2 nie je nainštalované"
        log_info "Reštartuj server manuálne"
    fi
}

# Zobrazenie súhrnu
show_summary() {
    echo
    log_info "📋 Súhrn nastavenia:"
    echo "PIPER_PATH=$PIPER_PATH"
    echo "PIPER_VOICES_PATH=$PIPER_VOICES_PATH"
    echo "TTS_VOICE=$TTS_VOICE"
    echo "TTS_CACHE_ENABLED=$TTS_CACHE_ENABLED"
    echo
    log_info "🔧 Ďalšie kroky:"
    echo "1. source ~/.profile  # Načítaj premenné"
    echo "2. pm2 restart voice-chat  # Reštartuj server"
    echo "3. node tts-diagnostics.js  # Spusti diagnostiku"
    echo "4. Otvor websocket-test.html v prehliadači"
}

# Hlavná funkcia
main() {
    check_server
    setup_environment
    check_piper_binary
    check_voices_directory
    check_voice_file
    test_tts_generation
    restart_service
    show_summary
    
    log_success "Setup dokončený!"
}

# Spusti setup
main "$@"
