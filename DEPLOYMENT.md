# Oracle Voice Chat Backend - Deployment Guide

## 🚀 Nasadenie na Oracle Cloud

### Predpoklady

1. **Oracle Cloud VM** s Oracle Linux 8/9
2. **Verejná IP adresa** a otvorené porty 80, 443, 3000
3. **Cloudflare účet** pre DNS a SSL
4. **API kľúče**: Deepgram a OpenAI (voliteľné pre testovanie)

### Krok 1: Príprava Oracle VM

```bash
# Pripojenie na Oracle VM
ssh opc@YOUR_ORACLE_VM_IP

# Aktualizácia systému
sudo yum update -y

# Inštalácia základných balíkov
sudo yum install -y curl wget git nano htop
```

### Krok 2: Nahratie aplikácie

```bash
# Vytvorenie aplikačného adresára
sudo mkdir -p /opt/oracle-voice-chat
sudo chown opc:opc /opt/oracle-voice-chat
cd /opt/oracle-voice-chat

# Nahratie archívu (použite scp alebo wget)
# Možnosť 1: SCP z lokálneho počítača
scp oracle-voice-chat-backend.tar.gz opc@YOUR_ORACLE_VM_IP:/opt/oracle-voice-chat/

# Možnosť 2: Wget z GitHub releases (ak máte repozitár)
# wget https://github.com/YOUR_USERNAME/oracle-voice-chat/releases/latest/download/oracle-voice-chat-backend.tar.gz

# Rozbalenie archívu
tar -xzf oracle-voice-chat-backend.tar.gz
rm oracle-voice-chat-backend.tar.gz
```

### Krok 3: Konfigurácia

```bash
# Úprava .env súboru
nano .env

# Dôležité nastavenia:
# DEEPGRAM_API_KEY=your_real_deepgram_key
# OPENAI_API_KEY=your_real_openai_key
# ALLOWED_ORIGINS=https://your-frontend-domain.pages.dev
```

### Krok 4: SSL Certifikáty (Cloudflare Origin Certificate)

```bash
# Vytvorenie SSL adresára
mkdir -p ssl

# Nahratie Cloudflare Origin Certificate
# 1. V Cloudflare Dashboard: SSL/TLS > Origin Server > Create Certificate
# 2. Skopírujte Certificate do ssl/origin.crt
# 3. Skopírujte Private Key do ssl/origin.key

nano ssl/origin.crt  # Vložte certificate
nano ssl/origin.key  # Vložte private key

# Nastavenie práv
chmod 600 ssl/origin.key
chmod 644 ssl/origin.crt
```

### Krok 5: Spustenie aplikácie

```bash
# Spustenie deployment scriptu
sudo ./deploy-oracle.sh
```

### Krok 6: Overenie nasadenia

```bash
# Kontrola stavu kontajnerov
docker-compose ps

# Kontrola logov
docker-compose logs -f

# Health check
curl http://localhost/health
curl https://YOUR_DOMAIN/health
```

### Krok 7: Konfigurácia Cloudflare

1. **DNS záznamy**:
   - A record: `@` → `YOUR_ORACLE_VM_IP`
   - A record: `api` → `YOUR_ORACLE_VM_IP` (voliteľné)

2. **SSL/TLS nastavenia**:
   - SSL/TLS encryption mode: **Full (strict)**
   - Always Use HTTPS: **On**

3. **Firewall pravidlá** (Oracle Cloud):
   ```bash
   # Otvorenie portov v Oracle Cloud Security List
   # Port 80 (HTTP)
   # Port 443 (HTTPS)
   # Port 3000 (Backend - voliteľné pre debug)
   ```

## 🔧 Údržba

### Aktualizácia aplikácie

```bash
cd /opt/oracle-voice-chat

# Stiahnuť nové zmeny
git pull origin main  # ak používate Git

# Alebo nahrajte nový archív a rozbaľte

# Reštart aplikácie
sudo docker-compose down
sudo docker-compose up -d --build
```

### Monitoring

```bash
# Logy aplikácie
docker-compose logs -f voice-chat-backend

# Logy Nginx
docker-compose logs -f nginx

# Systémové zdroje
htop
df -h
```

### Zálohovanie

```bash
# Záloha konfigurácie
tar -czf backup-$(date +%Y%m%d).tar.gz .env ssl/ logs/

# Záloha Redis dát (ak používate)
docker-compose exec redis redis-cli BGSAVE
```

## 🐛 Riešenie problémov

### Aplikácia sa nespustí

```bash
# Kontrola logov
docker-compose logs

# Kontrola portov
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# Kontrola firewall
sudo firewall-cmd --list-all
```

### WebSocket spojenie zlyhá

```bash
# Kontrola Nginx konfigurácie
docker-compose exec nginx nginx -t

# Kontrola WebSocket proxy
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" https://YOUR_DOMAIN/ws
```

### SSL problémy

```bash
# Kontrola certifikátov
openssl x509 -in ssl/origin.crt -text -noout

# Test SSL spojenia
openssl s_client -connect YOUR_DOMAIN:443
```

## 📊 Metriky a monitoring

- Health check: `https://YOUR_DOMAIN/health`
- Metriky: `https://YOUR_DOMAIN/api/metrics`
- WebSocket test: `https://YOUR_DOMAIN/websocket-test.html`

## 🔐 Bezpečnosť

1. **Pravidelné aktualizácie**:
   ```bash
   sudo yum update -y
   docker-compose pull
   ```

2. **Monitoring logov**:
   ```bash
   tail -f logs/nginx/access.log
   ```

3. **Rate limiting**: Nakonfigurované v Nginx (10 req/s pre API, 5 req/s pre WebSocket)

4. **Firewall**: Len potrebné porty (80, 443) sú otvorené
