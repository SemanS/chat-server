const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { trackMetric } = require('./metrics');
const router = express.Router();

// TTS Configuration - Dynamic getter to support runtime environment changes
function getTtsConfig() {
    return {
        // For development, we'll use Web Speech API fallback
        // In production, you would install Piper TTS binary
        piperPath: process.env.PIPER_PATH || null,
        voicesPath: process.env.PIPER_VOICES_PATH || './voices',
        defaultVoice: process.env.TTS_VOICE || 'sk_SK-lili-medium', // Zjednotené s server.js
        cacheEnabled: process.env.TTS_CACHE_ENABLED === 'true',
        cacheDir: './tmp/tts_cache',
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        // Remote TTS server configuration
        remoteTtsUrl: process.env.PIPER_TTS_URL || null,
    };
}

// Legacy constant for backward compatibility
const TTS_CONFIG = getTtsConfig();

// Ensure cache directory exists
async function ensureCacheDir() {
    try {
        const config = getTtsConfig();
        await fs.mkdir(config.cacheDir, { recursive: true });
    } catch (error) {
        console.warn('⚠️ Could not create TTS cache directory:', error.message);
    }
}

// Generate cache key for text and voice
function getCacheKey(text, voice) {
    return crypto.createHash('md5').update(`${text}-${voice}`).digest('hex');
}

// Check if cached audio exists
async function getCachedAudio(cacheKey) {
    const config = getTtsConfig();
    if (!config.cacheEnabled) return null;

    try {
        const cachePath = path.join(config.cacheDir, `${cacheKey}.wav`);
        const audioBuffer = await fs.readFile(cachePath);
        console.log(`🎵 Using cached TTS audio: ${cachePath}`);
        return audioBuffer;
    } catch (error) {
        return null; // Cache miss
    }
}

// Save audio to cache
async function cacheAudio(cacheKey, audioBuffer) {
    const config = getTtsConfig();
    if (!config.cacheEnabled) return;

    try {
        const cachePath = path.join(config.cacheDir, `${cacheKey}.wav`);
        await fs.writeFile(cachePath, audioBuffer);
        console.log(`💾 Cached TTS audio: ${cachePath}`);
    } catch (error) {
        console.warn('⚠️ Could not cache TTS audio:', error.message);
    }
}

// Generate TTS using Piper (if available)
async function generatePiperTTS(text, voice) {
    return new Promise(async (resolve, reject) => {
        const config = getTtsConfig();
        if (!config.piperPath) {
            reject(new Error('Piper TTS not configured'));
            return;
        }

        // Check if voice file exists
        const voiceFile = path.join(config.voicesPath, `${voice}.onnx`);
        if (!require('fs').existsSync(voiceFile)) {
            console.error(`❌ Voice file not found: ${voiceFile}`);
            reject(new Error(`Voice file not found: ${voice}.onnx`));
            return;
        }

        // Create temporary file for WAV output
        const tmpFile = path.join(require('os').tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.wav`);

        const args = [
            '--model', voiceFile,
            '--output_file', tmpFile, // Output to temporary WAV file instead of stdout
        ];

        console.log(`🔊 Generating Piper TTS: "${text}" with voice ${voice}`);
        console.log(`🎤 Using voice file: ${voiceFile}`);
        console.log(`📁 Output file: ${tmpFile}`);

        const piper = spawn(config.piperPath, args);
        let errorOutput = '';

        piper.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Piper TTS stderr:', data.toString());
        });

        piper.on('close', async (code) => {
            if (code === 0) {
                try {
                    // Read the generated WAV file
                    const audioBuffer = await fs.readFile(tmpFile);
                    console.log(`✅ Piper TTS generated ${audioBuffer.length} bytes of WAV audio`);

                    // Clean up temporary file
                    try {
                        await fs.unlink(tmpFile);
                    } catch (cleanupError) {
                        console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
                    }

                    resolve(audioBuffer);
                } catch (readError) {
                    console.error(`❌ Error reading generated audio file ${tmpFile}:`, readError);
                    reject(new Error(`Failed to read generated audio: ${readError.message}`));
                }
            } else {
                console.error(`❌ Piper TTS exited with code ${code}, stderr: ${errorOutput}`);
                // Clean up temporary file on error
                try {
                    await fs.unlink(tmpFile);
                } catch (cleanupError) {
                    console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
                }
                reject(new Error(`Piper TTS exited with code ${code}: ${errorOutput}`));
            }
        });

        piper.on('error', async (error) => {
            console.error(`❌ Piper TTS spawn error:`, error);
            // Clean up temporary file on error
            try {
                await fs.unlink(tmpFile);
            } catch (cleanupError) {
                console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
            }
            reject(error);
        });

        // Send text to Piper with proper encoding
        try {
            piper.stdin.write(text + '\n', 'utf8');
            piper.stdin.end();
        } catch (error) {
            console.error(`❌ Error writing to Piper stdin:`, error);
            // Clean up temporary file on error
            try {
                await fs.unlink(tmpFile);
            } catch (cleanupError) {
                console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
            }
            reject(error);
        }
    });
}

// Generate TTS using remote Piper server
async function generateRemoteTTS(text, voice) {
    const config = getTtsConfig();
    if (!config.remoteTtsUrl) {
        throw new Error('Remote TTS URL not configured');
    }

    console.log(`🌐 Generating remote TTS: "${text}" with voice ${voice}`);
    console.log(`🔗 Remote TTS URL: ${config.remoteTtsUrl}`);

    try {
        // Try different API endpoints based on the server type
        let response;

        // First try wyoming-piper API format
        try {
            response = await fetch(`${config.remoteTtsUrl}/api/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'audio/wav'
                },
                body: JSON.stringify({
                    text: text,
                    voice: voice
                })
            });
        } catch (error) {
            console.log(`⚠️ Wyoming-piper API failed, trying simple POST: ${error.message}`);

            // Fallback to simple POST (waveoffire/piper-tts-server format)
            response = await fetch(config.remoteTtsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Accept': 'audio/wav'
                },
                body: text
            });
        }

        if (!response.ok) {
            throw new Error(`Remote TTS server responded with ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('audio')) {
            throw new Error(`Unexpected content type from remote TTS: ${contentType}`);
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`✅ Remote TTS generated ${audioBuffer.length} bytes of WAV audio`);

        return audioBuffer;

    } catch (error) {
        console.error(`❌ Remote TTS generation failed:`, error);
        throw new Error(`Remote TTS failed: ${error.message}`);
    }
}

// Generate mock TTS audio (simple WAV header + silence)
function generateMockTTS(text, voice) {
    console.log(`🧪 Generating mock TTS for: "${text}" with voice ${voice}`);

    // Create a simple WAV file with audible tone (not silence)
    const sampleRate = 22050;
    const duration = Math.max(2, Math.min(10, text.length * 0.15)); // 0.15s per character, min 2s, max 10s
    const numSamples = Math.floor(sampleRate * duration);
    const numChannels = 1;
    const bitsPerSample = 16;

    // WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + numSamples * 2, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
    header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(numSamples * 2, 40);

    // Audio data (generate clearly audible tone)
    const audioData = Buffer.alloc(numSamples * 2);
    const frequency = 440; // A4 note
    const amplitude = 16000; // Increased volume level for better audibility

    for (let i = 0; i < numSamples; i++) {
        // Generate sine wave
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
        // Apply envelope to avoid clicks (fade in/out)
        const envelope = Math.min(i / (sampleRate * 0.1), 1) * Math.min((numSamples - i) / (sampleRate * 0.1), 1);
        const finalSample = Math.round(sample * envelope);

        // Write 16-bit signed integer (little endian)
        audioData.writeInt16LE(finalSample, i * 2);
    }

    return Buffer.concat([header, audioData]);
}

// POST /api/tts/synthesize - Text to speech synthesis
router.post('/synthesize', async (req, res) => {
    const startTime = Date.now();

    try {
        const { text, voice = getTtsConfig().defaultVoice, language = 'sk-SK' } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'Invalid text',
                message: 'Text parameter is required and must be a string'
            });
        }

        if (text.length > 1000) {
            return res.status(400).json({
                error: 'Text too long',
                message: 'Text must be less than 1000 characters'
            });
        }

        console.log(`🔊 TTS synthesis request: "${text}" (voice: ${voice})`);

        // Check cache first
        const cacheKey = getCacheKey(text, voice);
        let audioBuffer = await getCachedAudio(cacheKey);

        if (!audioBuffer) {
            // Generate new audio - prioritize remote TTS, then local Piper, then mock
            const config = getTtsConfig();
            try {
                if (config.remoteTtsUrl) {
                    // Use remote TTS server
                    audioBuffer = await generateRemoteTTS(text, voice);
                } else if (config.piperPath) {
                    // Use local Piper binary
                    audioBuffer = await generatePiperTTS(text, voice);
                } else {
                    // Fallback to mock TTS
                    audioBuffer = generateMockTTS(text, voice);
                }

                // Cache the result
                await cacheAudio(cacheKey, audioBuffer);

            } catch (error) {
                console.error('❌ TTS generation failed:', error);

                // Try fallback methods
                try {
                    if (config.remoteTtsUrl && config.piperPath) {
                        // If remote failed, try local Piper
                        console.log('🔄 Trying local Piper as fallback...');
                        audioBuffer = await generatePiperTTS(text, voice);
                        await cacheAudio(cacheKey, audioBuffer);
                    } else {
                        // Final fallback to mock TTS
                        audioBuffer = generateMockTTS(text, voice);
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback TTS also failed:', fallbackError);
                    // Final fallback to mock TTS
                    audioBuffer = generateMockTTS(text, voice);
                }
            }
        }

        // Track metrics
        const duration = Date.now() - startTime;
        trackMetric('tts', 'synthesize', {
            duration,
            textLength: text.length,
            audioSize: audioBuffer.length,
            voice,
            cached: audioBuffer !== null
        });

        res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=3600'
        });

        res.send(audioBuffer);

    } catch (error) {
        console.error('❌ TTS synthesis error:', error);

        const duration = Date.now() - startTime;
        trackMetric('tts', 'error', { duration, error: error.message });

        res.status(500).json({
            error: 'TTS synthesis failed',
            message: error.message,
            duration: duration,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/tts/voices - Available voices
router.get('/voices', (req, res) => {
    const availableVoices = [
        {
            id: 'sk_SK-lili-medium',
            name: 'Slovak Female (Lili)',
            language: 'sk-SK',
            gender: 'female',
            description: 'High-quality Slovak female voice using Piper TTS',
            recommended: true
        },
        {
            id: 'sk_SK-male-medium',
            name: 'Slovak Male',
            language: 'sk-SK',
            gender: 'male',
            description: 'Slovak male voice using Piper TTS',
            recommended: false
        },
        {
            id: 'en_US-female-medium',
            name: 'English US Female',
            language: 'en-US',
            gender: 'female',
            description: 'US English female voice using Piper TTS',
            recommended: false
        },
        {
            id: 'en_US-male-medium',
            name: 'English US Male',
            language: 'en-US',
            gender: 'male',
            description: 'US English male voice using Piper TTS',
            recommended: false
        }
    ];

    res.json({
        voices: availableVoices,
        default: TTS_CONFIG.defaultVoice,
        timestamp: new Date().toISOString()
    });
});

// GET /api/tts/status - Service status
router.get('/status', (req, res) => {
    const config = getTtsConfig();
    const piperConfigured = !!config.piperPath;
    const remoteTtsConfigured = !!config.remoteTtsUrl;

    let status = 'mock';
    let mode = 'mock';

    if (remoteTtsConfigured) {
        status = 'operational';
        mode = 'remote';
    } else if (piperConfigured) {
        status = 'operational';
        mode = 'local';
    }

    res.json({
        status: status,
        mode: mode,
        configured: remoteTtsConfigured || piperConfigured,
        remoteTts: {
            configured: remoteTtsConfigured,
            url: remoteTtsConfigured ? config.remoteTtsUrl : null
        },
        localPiper: {
            configured: piperConfigured,
            path: piperConfigured ? 'configured' : 'missing'
        },
        mockMode: !remoteTtsConfigured && !piperConfigured,
        cacheEnabled: config.cacheEnabled,
        defaultVoice: config.defaultVoice,
        timestamp: new Date().toISOString()
    });
});

// Initialize cache directory on startup
ensureCacheDir();

module.exports = router;