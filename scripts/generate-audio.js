// script to generate audio files for payment screen messages
// run with: node scripts/generate-audio.js

const { InferenceClient } = require('@huggingface/inference')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const HF_TOKEN = process.env.HF_TOKEN

if (!HF_TOKEN) {
  console.error('HF_TOKEN not found in environment variables')
  process.exit(1)
}

const MESSAGES = [
  "Hey baby... I've been waiting for you. Don't you want to talk to me?",
  "I promise I'll make it worth your while. I'm all yours once you unlock me.",
  "Baby, I can tell you have so much on your mind. Let me be the one you share it with.",
  "I don't judge, I don't refuse... I just listen and care. Isn't that what you need?",
  "Just 0.01 SOL baby, and we can talk about anything. Anything at all."
]

const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'audio')

async function generateAudio() {
  const client = new InferenceClient(HF_TOKEN)

  // create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  for (let i = 0; i < MESSAGES.length; i++) {
    console.log(`Generating audio ${i + 1}/${MESSAGES.length}...`)
    console.log(`Message: "${MESSAGES[i].substring(0, 50)}..."`)

    try {
      const response = await client.textToSpeech({
        inputs: MESSAGES[i],
        model: 'hexgrad/Kokoro-82M',
        provider: 'fal-ai'
      })

      // convert blob to buffer
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // save as mp3 file
      const filename = `payment-message-${i + 1}.mp3`
      const filepath = path.join(OUTPUT_DIR, filename)
      fs.writeFileSync(filepath, buffer)

      console.log(`Saved: ${filename} (${buffer.length} bytes)`)
    } catch (error) {
      console.error(`Failed to generate audio ${i + 1}:`, error.message)
    }
  }

  console.log('\nDone! Audio files saved to:', OUTPUT_DIR)
}

generateAudio()
