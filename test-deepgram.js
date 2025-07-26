#!/usr/bin/env node

const { createClient } = require('@deepgram/sdk');
require('dotenv').config();

async function testDeepgram() {
    console.log('🧪 Testing Deepgram API configuration...');
    
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey || apiKey === 'your-deepgram-api-key-here') {
        console.error('❌ DEEPGRAM_API_KEY not configured');
        return;
    }
    
    console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`);
    
    try {
        const deepgram = createClient(apiKey);
        
        // Test 1: Check available models
        console.log('\n📋 Testing available models...');
        
        // Test 2: Test with simple audio buffer (silence)
        console.log('\n🎵 Testing transcription with sample audio...');
        
        // Create a simple WAV header for silence (1 second, 16kHz, mono)
        const sampleRate = 16000;
        const duration = 1; // 1 second
        const numSamples = sampleRate * duration;
        const bufferSize = 44 + (numSamples * 2); // WAV header + PCM data
        
        const buffer = Buffer.alloc(bufferSize);
        
        // WAV header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(bufferSize - 8, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16); // PCM format chunk size
        buffer.writeUInt16LE(1, 20);  // PCM format
        buffer.writeUInt16LE(1, 22);  // Mono
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
        buffer.writeUInt16LE(2, 32);  // Block align
        buffer.writeUInt16LE(16, 34); // Bits per sample
        buffer.write('data', 36);
        buffer.writeUInt32LE(numSamples * 2, 40);
        // PCM data (silence) is already zeros from Buffer.alloc
        
        const options = {
            model: 'nova-2',
            detect_language: true,
            smart_format: true,
            punctuate: true
        };
        
        console.log(`🔧 Using options:`, options);
        
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            buffer,
            options
        );
        
        if (error) {
            console.error('❌ Deepgram API error:', error);
            
            // Try with different model
            console.log('\n🔄 Trying with different model...');
            const fallbackOptions = {
                model: 'nova',
                detect_language: true,
                smart_format: true,
                punctuate: true
            };
            
            console.log(`🔧 Using fallback options:`, fallbackOptions);
            
            const { result: result2, error: error2 } = await deepgram.listen.prerecorded.transcribeFile(
                buffer,
                fallbackOptions
            );
            
            if (error2) {
                console.error('❌ Fallback also failed:', error2);
            } else {
                console.log('✅ Fallback successful!');
                console.log('📝 Result:', result2?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '(no transcript)');
            }
        } else {
            console.log('✅ Deepgram API test successful!');
            console.log('📝 Transcript:', result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '(no transcript - expected for silence)');
            console.log('🎯 Confidence:', result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 'N/A');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Full error:', error);
    }
}

if (require.main === module) {
    testDeepgram().catch(console.error);
}

module.exports = { testDeepgram };
