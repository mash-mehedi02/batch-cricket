/**
 * Text-to-Speech Utility
 * Supports English and Bangla languages
 */

export type TTSLanguage = 'en' | 'bn'

class TextToSpeechService {
  private isEnabled: boolean = false
  private language: TTSLanguage = 'en'
  private synth: SpeechSynthesis | null = null
  private currentUtterance: SpeechSynthesisUtterance | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis
    }
  }

  /**
   * Enable/Disable TTS
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    if (!enabled && this.synth) {
      this.synth.cancel()
    }
  }

  /**
   * Set language
   */
  setLanguage(lang: TTSLanguage) {
    this.language = lang
  }

  /**
   * Speak text
   */
  speak(text: string) {
    if (!this.isEnabled || !this.synth) return

    // Cancel any ongoing speech
    if (this.currentUtterance) {
      this.synth.cancel()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = this.language === 'en' ? 'en-US' : 'bn-BD'
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0

    this.currentUtterance = utterance

    utterance.onend = () => {
      this.currentUtterance = null
    }

    utterance.onerror = (error) => {
      console.error('TTS Error:', error)
      this.currentUtterance = null
    }

    this.synth.speak(utterance)
  }

  /**
   * Stop speaking
   */
  stop() {
    if (this.synth) {
      this.synth.cancel()
      this.currentUtterance = null
    }
  }

  /**
   * Check if TTS is available
   */
  isAvailable(): boolean {
    return this.synth !== null
  }

  /**
   * Get available voices for language
   */
  getVoices(lang: TTSLanguage): SpeechSynthesisVoice[] {
    if (!this.synth) return []
    const voices = this.synth.getVoices()
    const langCode = lang === 'en' ? 'en' : 'bn'
    return voices.filter(voice => voice.lang.startsWith(langCode))
  }
}

export const ttsService = new TextToSpeechService()

