# Universal Oracle Voice Chat Backend Deployment

Univerzálny deployment script pre nasadenie Oracle Voice Chat Backend systému na produkčný server.

## 🚀 Funkcie

- **Kompletný deployment** - Nasadenie celého systému vrátane závislostí
- **Piper TTS integrácia** - Automatická inštalácia a konfigurácia Piper TTS
- **Docker kontajnerizácia** - Použitie Docker Compose pre správu služieb
- **Automatické testovanie** - Overenie funkčnosti po deployment
- **Rollback podpora** - Možnosť vrátenia na predchádzajúcu verziu
- **Flexibilná konfigurácia** - Nastavenie cez environment variables

## 📋 Prerekvizity

### Lokálne
- Bash shell
- SSH kľúč pre prístup na server
- Prístup k internetu

### Server (Oracle Cloud)
- Ubuntu 20.04+ 
- Sudo prístup
- Otvorené porty: 80, 443, 3000
- Minimálne 2GB RAM, 20GB disk

## ⚙️ Konfigurácia

### Environment Variables

```bash
# Povinné
export SERVER_IP="129.159.9.170"
export SSH_KEY="/path/to/your/ssh-key.key"
export DEEPGRAM_API_KEY="your-deepgram-api-key"
export OPENAI_API_KEY="your-openai-api-key"

# Voliteľné
export SSH_USER="ubuntu"                    # default: ubuntu
export REMOTE_DIR="/home/ubuntu/chat-server" # default: /home/ubuntu/chat-server
export TTS_VOICE="sk_SK-lili-medium"       # default: sk_SK-lili-medium
```

### API Kľúče

1. **Deepgram API** - Pre speech-to-text
   - Registrácia: https://deepgram.com
   - Získanie API kľúča z dashboard

2. **OpenAI API** - Pre AI chat responses
   - Registrácia: https://platform.openai.com
   - Vytvorenie API kľúča v nastaveniach

## 🎯 Použitie

### Štandardný Deployment

```bash
# Nastavenie environment variables
export SERVER_IP="your-server-ip"
export SSH_KEY="/path/to/ssh-key.key"
export DEEPGRAM_API_KEY="your-deepgram-key"
export OPENAI_API_KEY="your-openai-key"

# Spustenie deployment
./deploy-universal.sh
```

### Rýchly Deployment (bez potvrdenia)

```bash
./deploy-universal.sh quick
```

### Deployment len kódu

```bash
./deploy-universal.sh code-only
```

### Rollback na predchádzajúcu verziu

```bash
./deploy-universal.sh rollback
```

### Zobrazenie nápovedy

```bash
./deploy-universal.sh help
```

## 🔧 Čo script robí

### 1. Príprava (Preparation)
- ✅ Kontrola prerekvizít (SSH kľúč, prístup na server)
- ✅ Vytvorenie archívu lokálneho kódu
- ✅ Zobrazenie konfigurácie

### 2. Nasadenie kódu (Code Deployment)
- ✅ Kopírovanie kódu na server
- ✅ Backup existujúcej inštalácie
- ✅ Rozbalenie nového kódu

### 3. Systémové závislosti (System Dependencies)
- ✅ Aktualizácia systému
- ✅ Inštalácia Docker a Docker Compose
- ✅ Inštalácia základných nástrojov

### 4. Piper TTS Setup
- ✅ Stiahnutie Piper TTS binary (v1.2.0)
- ✅ Stiahnutie slovenského voice modelu (sk_SK-lili-medium)
- ✅ Konfigurácia TTS systému
- ✅ Test funkčnosti

### 5. Konfigurácia (Configuration)
- ✅ Vytvorenie .env súboru s API kľúčmi
- ✅ Konfigurácia Docker Compose
- ✅ Nastavenie volume mounts

### 6. Spustenie služieb (Service Startup)
- ✅ Build Docker images
- ✅ Spustenie kontajnerov (backend + Redis)
- ✅ Inštalácia Piper TTS do kontajnera
- ✅ Konfigurácia runtime environment

### 7. Testovanie (Testing)
- ✅ Health check endpoint
- ✅ Deepgram API status
- ✅ OpenAI API status  
- ✅ Piper TTS funkcionalita
- ✅ WebSocket pripojenie

## 📊 Výstup

Po úspešnom deployment uvidíte:

```
🎉 DEPLOYMENT ÚSPEŠNE DOKONČENÝ!
==============================================

🌐 Server je dostupný na:
   HTTP:      http://your-server-ip:3000
   HTTPS:     https://your-server-ip
   WebSocket: wss://your-server-ip/ws
   Test Page: https://your-server-ip/websocket-test.html

🔧 Správa služieb:
   docker-compose ps              # Stav kontajnerov
   docker-compose logs -f         # Logy
   docker-compose restart         # Restart
   docker-compose down            # Stop
```

## 🐛 Riešenie problémov

### Časté problémy

1. **SSH pripojenie zlyháva**
   ```bash
   # Skontroluj SSH kľúč
   ssh -i /path/to/key.key ubuntu@server-ip
   ```

2. **Docker build zlyháva**
   ```bash
   # Skontroluj logy
   ssh -i key.key ubuntu@server-ip 'cd /home/ubuntu/chat-server && docker-compose logs'
   ```

3. **Piper TTS nefunguje**
   ```bash
   # Test v kontajneri
   docker exec oracle-voice-chat-backend /usr/bin/piper --version
   ```

4. **API kľúče nefungujú**
   ```bash
   # Skontroluj .env súbor
   ssh -i key.key ubuntu@server-ip 'cd /home/ubuntu/chat-server && cat .env'
   ```

### Logy

```bash
# Všetky logy
docker-compose logs -f

# Len backend logy
docker-compose logs -f voice-chat-backend

# Systémové logy
sudo journalctl -u docker -f
```

## 🔒 Bezpečnosť

- SSH kľúče sú chránené (chmod 600)
- API kľúče sú uložené v .env súbore
- SSL certifikáty pre HTTPS
- Rate limiting pre API endpoints
- CORS konfigurácia

## 📈 Monitoring

Po deployment môžete monitorovať:

- **Health check**: `curl http://server-ip:3000/health`
- **API status**: `curl http://server-ip:3000/api/deepgram/status`
- **Container status**: `docker-compose ps`
- **Resource usage**: `docker stats`

## 🔄 Aktualizácie

Pre aktualizáciu kódu:

```bash
# Len kód (rýchle)
./deploy-universal.sh code-only

# Kompletná aktualizácia
./deploy-universal.sh
```

## 📞 Podpora

Pri problémoch skontrolujte:
1. Logy kontajnerov
2. Systémové logy  
3. Network connectivity
4. API kľúče validity
5. SSL certifikáty

---

**Autor**: Oracle Voice Chat Team  
**Verzia**: 1.0  
**Dátum**: 2025-07-27
