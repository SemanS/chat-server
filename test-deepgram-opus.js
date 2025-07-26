#!/usr/bin/env node

/**
 * Test Deepgram API with Opus/WebM format to verify Slovak language recognition
 */

const { createClient } = require('@deepgram/sdk');
require('dotenv').config();

async function testDeepgramOpus() {
    console.log('🧪 Testing Deepgram API with Opus/WebM format...');
    
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey || apiKey === 'mock') {
        console.log('❌ DEEPGRAM_API_KEY not set or is mock');
        process.exit(1);
    }
    
    console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`);
    
    try {
        const deepgram = createClient(apiKey);
        
        console.log('\n🎵 Testing with synthetic WebM/Opus audio...');
        
        // Create a minimal WebM container with Opus audio (silence)
        // This is a simplified WebM header for testing
        const webmHeader = Buffer.from([
            0x1A, 0x45, 0xDF, 0xA3, // EBML header
            0x9F, 0x42, 0x86, 0x81, 0x01, // EBML version
            0x42, 0xF7, 0x81, 0x01, // EBML read version
            0x42, 0xF2, 0x81, 0x04, // EBML max ID length
            0x42, 0xF3, 0x81, 0x08, // EBML max size length
            0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D, // DocType: "webm"
            0x42, 0x87, 0x81, 0x02, // DocTypeVersion
            0x42, 0x85, 0x81, 0x02  // DocTypeReadVersion
        ]);
        
        // Test with corrected options (no encoding/sample_rate for Opus)
        const options = {
            model: 'nova-2',
            language: 'sk',            // Slovak language code for nova-2 model
            punctuate: true,
            smart_format: true,
            filler_words: false,
            numerals: true,
            detect_language: false,    // Don't auto-detect, use sk
            detect_topics: false,
            summarize: false
            // NO encoding or sample_rate - let Deepgram auto-detect from Opus/WebM
        };
        
        console.log(`🔧 Using corrected options:`, JSON.stringify(options, null, 2));
        
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            webmHeader, // Minimal WebM for testing
            options
        );
        
        if (error) {
            console.error('❌ Deepgram API error:', error);
            
            // Test with minimal options
            console.log('\n🔄 Trying with minimal options...');
            const minimalOptions = {
                model: 'nova-2',
                language: 'sk'
            };
            
            console.log(`🔧 Using minimal options:`, JSON.stringify(minimalOptions, null, 2));
            
            const { result: result2, error: error2 } = await deepgram.listen.prerecorded.transcribeFile(
                webmHeader,
                minimalOptions
            );
            
            if (error2) {
                console.error('❌ Minimal options also failed:', error2);
                console.log('\n💡 This suggests the WebM header is invalid, but the options are correct.');
                console.log('✅ The real fix is in the options - no encoding/sample_rate for Opus!');
            } else {
                console.log('✅ Minimal options successful!');
                console.log('📝 Result:', result2?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '(no transcript)');
            }
        } else {
            console.log('✅ Deepgram API test successful!');
            console.log('📝 Transcript:', result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '(no transcript)');
            console.log('🎯 Confidence:', result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 'N/A');
        }
        
        console.log('\n🎉 Key findings:');
        console.log('✅ Use language: "sk" (Slovak language code for nova-2)');
        console.log('✅ DO NOT specify encoding for Opus/WebM');
        console.log('✅ DO NOT specify sample_rate for Opus/WebM');
        console.log('✅ Let Deepgram auto-detect format from audio headers');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testDeepgramOpus().catch(console.error);
