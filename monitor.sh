#!/bin/bash

# Oracle Voice Chat Backend Monitoring Script
# Monitoring script pre Oracle Voice Chat Backend

set -euo pipefail

# Konfigurácia
SERVER_IP="${SERVER_IP:-129.159.9.170}"
SSH_KEY="${SSH_KEY:-/Users/hotovo/Documents/augment-projects/chat/ssh-key-2025-07-16 (3).key}"
SSH_USER="${SSH_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/chat-server}"

# Farby
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

# Kontrola stavu služieb
check_services() {
    echo -e "${PURPLE}🔍 KONTROLA SLUŽIEB${NC}"
    echo "===================="
    
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
cd /home/ubuntu/chat-server

echo "📊 Stav Docker kontajnerov:"
docker-compose ps

echo ""
echo "💾 Využitie zdrojov:"
docker stats --no-stream

echo ""
echo "🌐 Sieťové porty:"
sudo netstat -tlnp | grep -E ':(80|443|3000|6379)'
EOF
}

# Test API endpoints
test_apis() {
    echo ""
    echo -e "${PURPLE}🧪 TEST API ENDPOINTS${NC}"
    echo "======================"
    
    # Health check
    echo -n "🏥 Health check: "
    if curl -s -f "http://$SERVER_IP:3000/health" > /dev/null; then
        success "OK"
    else
        error "FAIL"
    fi
    
    # Deepgram API
    echo -n "🎤 Deepgram API: "
    if curl -s -f "http://$SERVER_IP:3000/api/deepgram/status" > /dev/null; then
        success "OK"
    else
        error "FAIL"
    fi
    
    # OpenAI API
    echo -n "🤖 OpenAI API: "
    if curl -s -f "http://$SERVER_IP:3000/api/chat/status" > /dev/null; then
        success "OK"
    else
        error "FAIL"
    fi
    
    # WebSocket test page
    echo -n "🔌 WebSocket test page: "
    if curl -s -f "https://$SERVER_IP/websocket-test.html" > /dev/null; then
        success "OK"
    else
        error "FAIL"
    fi
}

# Test Piper TTS
test_piper() {
    echo ""
    echo -e "${PURPLE}🔊 TEST PIPER TTS${NC}"
    echo "=================="
    
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
cd /home/ubuntu/chat-server

echo -n "🎵 Piper TTS test: "
if docker exec oracle-voice-chat-backend sh -c 'echo "Test slovenského hlasu" | /usr/bin/piper --model /app/voices/sk_SK-lili-medium.onnx --output_file /tmp/test.wav && ls -la /tmp/test.wav' > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi
EOF
}

# Zobrazenie logov
show_logs() {
    echo ""
    echo -e "${PURPLE}📋 POSLEDNÉ LOGY${NC}"
    echo "================="
    
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
cd /home/ubuntu/chat-server

echo "🐳 Docker Compose logy (posledných 20 riadkov):"
docker-compose logs --tail=20

echo ""
echo "🔧 Systémové logy (posledných 10 riadkov):"
sudo journalctl -u docker --no-pager -n 10
EOF
}

# Zobrazenie metrík
show_metrics() {
    echo ""
    echo -e "${PURPLE}📊 SYSTÉMOVÉ METRIKY${NC}"
    echo "===================="
    
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
echo "💻 CPU a pamäť:"
top -bn1 | head -5

echo ""
echo "💾 Disk space:"
df -h | grep -E '(Filesystem|/dev/)'

echo ""
echo "🌡️  Systémová záťaž:"
uptime

echo ""
echo "🔗 Aktívne pripojenia:"
ss -tuln | grep -E ':(80|443|3000|6379)'
EOF
}

# Hlavná funkcia
main() {
    echo -e "${GREEN}🔍 Oracle Voice Chat Backend Monitor${NC}"
    echo "====================================="
    echo ""
    echo "Server: $SERVER_IP"
    echo "Time: $(date)"
    echo ""
    
    case "${1:-all}" in
        "services")
            check_services
            ;;
        "apis")
            test_apis
            ;;
        "piper")
            test_piper
            ;;
        "logs")
            show_logs
            ;;
        "metrics")
            show_metrics
            ;;
        "all")
            check_services
            test_apis
            test_piper
            show_metrics
            ;;
        "help"|"-h"|"--help")
            echo "Oracle Voice Chat Backend Monitoring Script"
            echo ""
            echo "Použitie:"
            echo "  $0                 # Kompletný monitoring"
            echo "  $0 services        # Kontrola služieb"
            echo "  $0 apis            # Test API endpoints"
            echo "  $0 piper           # Test Piper TTS"
            echo "  $0 logs            # Zobrazenie logov"
            echo "  $0 metrics         # Systémové metriky"
            echo "  $0 help            # Táto nápoveda"
            echo ""
            ;;
        *)
            error "Neznámy parameter: $1"
            echo "Použite '$0 help' pre nápovedu"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}✅ Monitoring dokončený${NC}"
}

# Spustenie
main "$@"
