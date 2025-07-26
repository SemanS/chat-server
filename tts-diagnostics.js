#!/usr/bin/env node

/**
 * TTS Diagnostics Script
 * Rýchla diagnostika TTS problémov podľa vašej príručky
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔍 TTS Diagnostics - Rýchla diagnostika TTS problémov\n');

// Farby pre výstup
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironmentVariables() {
    log('📋 Krok 1: Kontrola environment variables', 'blue');
    
    const requiredVars = ['PIPER_PATH', 'PIPER_VOICES_PATH', 'TTS_VOICE'];
    let allOk = true;
    
    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            log(`  ✅ ${varName} = ${value}`, 'green');
        } else {
            log(`  ❌ ${varName} = CHÝBA!`, 'red');
            allOk = false;
        }
    });
    
    if (!allOk) {
        log('\n💡 Riešenie:', 'yellow');
        log('export PIPER_PATH=/usr/local/bin/piper');
        log('export PIPER_VOICES_PATH=/app/voices');
        log('export TTS_VOICE=sk_SK-lili-medium');
        log('source ~/.profile');
        log('pm2 restart voice-chat');
    }
    
    return allOk;
}

function checkVoiceFiles() {
    log('\n📋 Krok 2: Kontrola súborov s hlasmi', 'blue');
    
    const voicesPath = process.env.PIPER_VOICES_PATH || '/app/voices';
    const voiceName = process.env.TTS_VOICE || 'sk_SK-lili-medium';
    const voiceFile = path.join(voicesPath, `${voiceName}.onnx`);
    
    log(`  🔍 Hľadám: ${voiceFile}`);
    
    if (fs.existsSync(voiceFile)) {
        const stats = fs.statSync(voiceFile);
        log(`  ✅ Súbor existuje: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'green');
        return true;
    } else {
        log(`  ❌ Súbor neexistuje: ${voiceFile}`, 'red');
        
        // Skús nájsť podobné súbory
        if (fs.existsSync(voicesPath)) {
            const files = fs.readdirSync(voicesPath).filter(f => f.endsWith('.onnx'));
            if (files.length > 0) {
                log('\n  🔍 Dostupné hlasy:', 'yellow');
                files.forEach(file => log(`    - ${file}`));
            } else {
                log(`  ❌ Žiadne .onnx súbory v ${voicesPath}`, 'red');
            }
        } else {
            log(`  ❌ Adresár ${voicesPath} neexistuje`, 'red');
        }
        
        return false;
    }
}

function checkPiperBinary() {
    log('\n📋 Krok 3: Kontrola Piper binárky', 'blue');
    
    const piperPath = process.env.PIPER_PATH;
    if (!piperPath) {
        log('  ❌ PIPER_PATH nie je nastavené', 'red');
        return false;
    }
    
    if (fs.existsSync(piperPath)) {
        log(`  ✅ Piper binárka existuje: ${piperPath}`, 'green');
        
        // Test spustenia
        return new Promise((resolve) => {
            const piper = spawn(piperPath, ['--help'], { timeout: 5000 });
            let output = '';
            
            piper.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            piper.stderr.on('data', (data) => {
                output += data.toString();
            });
            
            piper.on('close', (code) => {
                if (code === 0 || output.includes('Usage:') || output.includes('piper')) {
                    log('  ✅ Piper sa spúšťa správne', 'green');
                    resolve(true);
                } else {
                    log(`  ❌ Piper sa nespúšťa (exit code: ${code})`, 'red');
                    log(`  📝 Output: ${output.substring(0, 200)}...`);
                    resolve(false);
                }
            });
            
            piper.on('error', (error) => {
                log(`  ❌ Chyba spustenia Piper: ${error.message}`, 'red');
                resolve(false);
            });
        });
    } else {
        log(`  ❌ Piper binárka neexistuje: ${piperPath}`, 'red');
        return false;
    }
}

async function testTTSGeneration() {
    log('\n📋 Krok 4: Test generovania TTS', 'blue');
    
    const piperPath = process.env.PIPER_PATH;
    const voicesPath = process.env.PIPER_VOICES_PATH || '/app/voices';
    const voiceName = process.env.TTS_VOICE || 'sk_SK-lili-medium';
    const voiceFile = path.join(voicesPath, `${voiceName}.onnx`);
    
    if (!piperPath || !fs.existsSync(piperPath) || !fs.existsSync(voiceFile)) {
        log('  ⏭️  Preskakujem - chýbajú prerekvizity', 'yellow');
        return false;
    }
    
    const testText = 'Ahoj, toto je test TTS.';
    const tmpFile = path.join(require('os').tmpdir(), `tts-test-${Date.now()}.wav`);
    
    log(`  🔊 Testujem: "${testText}"`);
    
    return new Promise((resolve) => {
        const args = ['--model', voiceFile, '--output_file', tmpFile];
        const piper = spawn(piperPath, args);
        
        let errorOutput = '';
        
        piper.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        piper.on('close', async (code) => {
            if (code === 0) {
                try {
                    const stats = fs.statSync(tmpFile);
                    log(`  ✅ TTS úspešne vygenerované: ${stats.size} bajtov`, 'green');
                    
                    // Vyčisti test súbor
                    fs.unlinkSync(tmpFile);
                    resolve(true);
                } catch (error) {
                    log(`  ❌ Chyba čítania výstupného súboru: ${error.message}`, 'red');
                    resolve(false);
                }
            } else {
                log(`  ❌ Piper TTS zlyhalo (exit code: ${code})`, 'red');
                if (errorOutput) {
                    log(`  📝 Chyba: ${errorOutput.substring(0, 200)}...`);
                }
                resolve(false);
            }
        });
        
        piper.on('error', (error) => {
            log(`  ❌ Chyba spustenia: ${error.message}`, 'red');
            resolve(false);
        });
        
        // Pošli test text
        try {
            piper.stdin.write(testText);
            piper.stdin.end();
        } catch (error) {
            log(`  ❌ Chyba zápisu do stdin: ${error.message}`, 'red');
            resolve(false);
        }
    });
}

function showAPIStatus() {
    log('\n📋 Krok 5: API Status endpoint', 'blue');
    log('  🌐 Otestuj: curl http://129.159.9.170:3000/api/tts/status');
    log('  📝 Očakávaný výstup:');
    log('    {"status":"operational","configured":true,"piperPath":"configured"}');
    log('  ❌ Ak vidíš "status":"mock" - chýbajú environment variables');
}

function showWebSocketTips() {
    log('\n📋 Krok 6: WebSocket debugging', 'blue');
    log('  🔧 V dev-tools prehliadača:');
    log('    1. Network → WS → Frames');
    log('    2. Hľadaj JSON správu + binárny frame');
    log('    3. Ak chýba binárny frame - server nič neposiela');
    log('  💡 Frontend fix:');
    log('    ws.binaryType = "arraybuffer";');
}

async function main() {
    const envOk = checkEnvironmentVariables();
    const voiceOk = checkVoiceFiles();
    const piperOk = await checkPiperBinary();
    const ttsOk = await testTTSGeneration();
    
    showAPIStatus();
    showWebSocketTips();
    
    log('\n📊 Súhrn diagnostiky:', 'blue');
    log(`  Environment variables: ${envOk ? '✅' : '❌'}`, envOk ? 'green' : 'red');
    log(`  Voice súbory: ${voiceOk ? '✅' : '❌'}`, voiceOk ? 'green' : 'red');
    log(`  Piper binárka: ${piperOk ? '✅' : '❌'}`, piperOk ? 'green' : 'red');
    log(`  TTS generovanie: ${ttsOk ? '✅' : '❌'}`, ttsOk ? 'green' : 'red');
    
    const allOk = envOk && voiceOk && piperOk && ttsOk;
    log(`\n🎯 Celkový stav: ${allOk ? 'FUNKČNÉ' : 'PROBLÉM'}`, allOk ? 'green' : 'red');
    
    if (!allOk) {
        log('\n🔧 Ďalšie kroky:', 'yellow');
        log('1. Oprav chyby uvedené vyššie');
        log('2. Reštartuj server: pm2 restart voice-chat');
        log('3. Spusti diagnostiku znovu');
    }
}

// Spusti diagnostiku
main().catch(console.error);
