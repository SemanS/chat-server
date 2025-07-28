#!/usr/bin/env node

/**
 * Test script pre Remote TTS funkcionalitu
 * Testuje či aplikácia správne rozpozná a použije remote TTS server
 */

const express = require('express');
const ttsRouter = require('./src/tts.js');

// Simulácia remote TTS servera
function createMockTtsServer() {
    const mockApp = express();
    mockApp.use(express.json());
    mockApp.use(express.text());

    // Mock Wyoming Piper API endpoint
    mockApp.post('/api/tts', (req, res) => {
        console.log('🎯 Mock TTS server received Wyoming API request:', req.body);
        
        // Simulácia WAV súboru (jednoduchý header)
        const mockWav = Buffer.alloc(44 + 1000); // WAV header + audio data
        mockWav.write('RIFF', 0);
        mockWav.writeUInt32LE(36 + 1000, 4);
        mockWav.write('WAVE', 8);
        
        res.set('Content-Type', 'audio/wav');
        res.send(mockWav);
    });

    // Mock simple POST endpoint
    mockApp.post('/', (req, res) => {
        console.log('🎯 Mock TTS server received simple POST:', req.body);
        
        // Simulácia WAV súboru
        const mockWav = Buffer.alloc(44 + 1000);
        mockWav.write('RIFF', 0);
        mockWav.writeUInt32LE(36 + 1000, 4);
        mockWav.write('WAVE', 8);
        
        res.set('Content-Type', 'audio/wav');
        res.send(mockWav);
    });

    return mockApp;
}

async function testRemoteTts() {
    console.log('🧪 Spúšťam test Remote TTS funkcionality...\n');

    // 1. Spustenie mock TTS servera
    const mockServer = createMockTtsServer();
    const mockPort = 5555;
    
    const server = mockServer.listen(mockPort, () => {
        console.log(`✅ Mock TTS server spustený na porte ${mockPort}`);
    });

    // 2. Nastavenie environment premennej pre test
    const originalUrl = process.env.PIPER_TTS_URL;
    process.env.PIPER_TTS_URL = `http://localhost:${mockPort}`;
    console.log(`🔧 Nastavené PIPER_TTS_URL=${process.env.PIPER_TTS_URL}`);

    // 3. Vytvorenie test aplikácie
    const app = express();
    app.use(express.json());
    app.use('/api/tts', ttsRouter);

    const testPort = 3333;
    const testServer = app.listen(testPort, async () => {
        console.log(`✅ Test aplikácia spustená na porte ${testPort}\n`);

        try {
            // 4. Test status endpointu
            console.log('📊 Testovanie /api/tts/status...');
            const statusResponse = await fetch(`http://localhost:${testPort}/api/tts/status`);
            const status = await statusResponse.json();
            
            console.log('Status response:', JSON.stringify(status, null, 2));
            
            if (status.remoteTts.configured && status.mode === 'remote') {
                console.log('✅ Status endpoint správne rozpoznal remote TTS\n');
            } else {
                console.log('❌ Status endpoint nerozpoznal remote TTS\n');
            }

            // 5. Test TTS synthesis
            console.log('🔊 Testovanie /api/tts/synthesize...');
            const synthesizeResponse = await fetch(`http://localhost:${testPort}/api/tts/synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'Toto je test remote TTS servera.',
                    voice: 'sk_SK-lili-medium'
                })
            });

            if (synthesizeResponse.ok) {
                const audioBuffer = await synthesizeResponse.arrayBuffer();
                console.log(`✅ TTS synthesis úspešný, vygenerované ${audioBuffer.byteLength} bytov audio dát`);
                
                // Kontrola či je to WAV súbor
                const wavHeader = new Uint8Array(audioBuffer.slice(0, 4));
                const headerString = String.fromCharCode(...wavHeader);
                if (headerString === 'RIFF') {
                    console.log('✅ Vygenerovaný súbor má správny WAV header');
                } else {
                    console.log('⚠️ Vygenerovaný súbor nemá WAV header');
                }
            } else {
                console.log(`❌ TTS synthesis zlyhal: ${synthesizeResponse.status} ${synthesizeResponse.statusText}`);
                const errorText = await synthesizeResponse.text();
                console.log('Error response:', errorText);
            }

        } catch (error) {
            console.error('❌ Test error:', error.message);
        } finally {
            // Cleanup
            console.log('\n🧹 Ukončovanie testov...');
            testServer.close();
            server.close();
            
            // Obnovenie pôvodnej environment premennej
            if (originalUrl) {
                process.env.PIPER_TTS_URL = originalUrl;
            } else {
                delete process.env.PIPER_TTS_URL;
            }
            
            console.log('✅ Test dokončený!');
        }
    });
}

// Spustenie testu
if (require.main === module) {
    testRemoteTts().catch(console.error);
}

module.exports = { testRemoteTts };
