# 🚀 Oracle Voice Chat Backend - Universal Deployment

Kompletný deployment systém pre Oracle Voice Chat Backend s Piper TTS integráciou.

## 📁 Súbory

```
chat-backend/
├── deploy-universal.sh      # Hlavný deployment script
├── quick-deploy.sh          # Rýchly deployment
├── monitor.sh              # Monitoring script
├── deploy.env.example      # Príklad konfigurácie
├── DEPLOYMENT-UNIVERSAL.md # Detailná dokumentácia
└── README-DEPLOYMENT.md    # Tento súbor
```

## ⚡ Quick Start

### 1. Príprava

```bash
# Skopíruj a uprav konfiguráciu
cp deploy.env.example deploy.env
nano deploy.env  # Nastav API kľúče

# Načítaj konfiguráciu
source deploy.env
```

### 2. Deployment

```bash
# Rýchly deployment
./quick-deploy.sh

# Alebo štandardný deployment s potvrdením
./deploy-universal.sh
```

### 3. Monitoring

```bash
# Kompletný monitoring
./monitor.sh

# Len test API
./monitor.sh apis
```

## 🎯 Deployment Módy

| Script | Popis | Použitie |
|--------|-------|----------|
| `deploy-universal.sh` | Kompletný deployment | Prvé nasadenie, veľké zmeny |
| `deploy-universal.sh quick` | Bez potvrdenia | Automatizované deployment |
| `deploy-universal.sh code-only` | Len kód | Malé zmeny v kóde |
| `deploy-universal.sh rollback` | Rollback | Návrat na predchádzajúcu verziu |
| `quick-deploy.sh` | Rýchly start | Jednoduché nasadenie |

## 📋 Checklist pred deployment

- [ ] API kľúče nastavené (Deepgram, OpenAI)
- [ ] SSH kľúč dostupný a funkčný
- [ ] Server dostupný (ping, SSH test)
- [ ] Oracle Cloud Security List nakonfigurovaný
- [ ] Backup existujúcej inštalácie (ak potrebné)

## 🔧 Konfigurácia

### Povinné Environment Variables

```bash
export SERVER_IP="129.159.9.170"
export SSH_KEY="/path/to/ssh-key.key"
export DEEPGRAM_API_KEY="your-deepgram-key"
export OPENAI_API_KEY="your-openai-key"
```

### Voliteľné Environment Variables

```bash
export SSH_USER="ubuntu"
export REMOTE_DIR="/home/ubuntu/chat-server"
export TTS_VOICE="sk_SK-lili-medium"
```

## 🧪 Testovanie

### Automatické testy (v scripte)

- ✅ Health check endpoint
- ✅ Deepgram API status
- ✅ OpenAI API status
- ✅ Piper TTS funkcionalita
- ✅ Docker kontajnery

### Manuálne testy

```bash
# API endpoints
curl http://server-ip:3000/health
curl http://server-ip:3000/api/deepgram/status
curl http://server-ip:3000/api/chat/status

# WebSocket test page
open https://server-ip/websocket-test.html

# Voice chat aplikácia
open https://your-frontend-url
```

## 📊 Monitoring

### Základný monitoring

```bash
./monitor.sh              # Kompletný monitoring
./monitor.sh services      # Stav služieb
./monitor.sh apis          # Test API endpoints
./monitor.sh piper         # Test Piper TTS
./monitor.sh logs          # Zobrazenie logov
./monitor.sh metrics       # Systémové metriky
```

### Pokročilé monitoring

```bash
# SSH na server
ssh -i ssh-key.key ubuntu@server-ip

# Docker logy
cd /home/ubuntu/chat-server
docker-compose logs -f

# Systémové logy
sudo journalctl -u docker -f

# Resource usage
docker stats
htop
```

## 🔄 Údržba

### Aktualizácia kódu

```bash
# Malé zmeny
./deploy-universal.sh code-only

# Veľké zmeny
./deploy-universal.sh
```

### Restart služieb

```bash
ssh -i ssh-key.key ubuntu@server-ip
cd /home/ubuntu/chat-server
docker-compose restart
```

### Rollback

```bash
./deploy-universal.sh rollback
```

### Backup

```bash
ssh -i ssh-key.key ubuntu@server-ip
sudo tar -czf backup-$(date +%Y%m%d).tar.gz /home/ubuntu/chat-server
```

## 🐛 Riešenie problémov

### Časté problémy

1. **SSH pripojenie zlyháva**
   - Skontroluj SSH kľúč permissions: `chmod 600 ssh-key.key`
   - Test pripojenia: `ssh -i ssh-key.key ubuntu@server-ip`

2. **API kľúče nefungujú**
   - Skontroluj .env súbor na serveri
   - Test API kľúčov lokálne

3. **Docker build zlyháva**
   - Skontroluj Docker logy: `docker-compose logs`
   - Restart Docker: `sudo systemctl restart docker`

4. **Piper TTS nefunguje**
   - Test v kontajneri: `docker exec oracle-voice-chat-backend /usr/bin/piper --version`
   - Skontroluj voice súbory: `ls -la /home/ubuntu/chat-server/piper-models/`

### Debug príkazy

```bash
# Stav kontajnerov
docker-compose ps

# Logy konkrétneho kontajnera
docker-compose logs voice-chat-backend

# Vstup do kontajnera
docker exec -it oracle-voice-chat-backend sh

# Test Piper TTS
docker exec oracle-voice-chat-backend echo "test" | /usr/bin/piper --model /app/voices/sk_SK-lili-medium.onnx --output_file /tmp/test.wav
```

## 📞 Podpora

Pri problémoch:

1. Spusti monitoring: `./monitor.sh`
2. Skontroluj logy: `./monitor.sh logs`
3. Test API endpoints: `./monitor.sh apis`
4. Skontroluj dokumentáciu: `DEPLOYMENT-UNIVERSAL.md`

## 🔗 Užitočné odkazy

- [Deepgram API Documentation](https://developers.deepgram.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Piper TTS Documentation](https://github.com/rhasspy/piper)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

**Verzia**: 1.0  
**Autor**: Oracle Voice Chat Team  
**Dátum**: 2025-07-27
