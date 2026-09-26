class SpeechCoach {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private lastSpoken: Map<string, number> = new Map();
  private COOLDOWN_MS = 4000;
  private isMuted = false;
  private currentLanguage: string = 'en';

  constructor() {
    this.synth = window.speechSynthesis;
    this.initVoice();
  }

  // Map app languages to BCP-47 locale prefixes
  private getLocalePrefix(langCode: string): string {
    const map: Record<string, string> = {
      'en': 'en',
      'hi': 'hi',
      'ta': 'ta',
      'te': 'te',
      'bn': 'bn'
    };
    return map[langCode] || 'en';
  }

  public setLanguage(langCode: string) {
    if (this.currentLanguage !== langCode) {
      this.currentLanguage = langCode;
      this.selectVoice();
    }
  }

  private initVoice() {
    this.selectVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.selectVoice();
    }
  }

  private selectVoice() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    const targetPrefix = this.getLocalePrefix(this.currentLanguage);

    // Filter voices that match the target language prefix
    const matchingVoices = voices.filter(v => v.lang.toLowerCase().startsWith(targetPrefix));

    if (matchingVoices.length > 0) {
      // Pick the best match (e.g. prioritize Google voices or first available)
      const googleVoice = matchingVoices.find(v => v.name.includes('Google'));
      this.voice = googleVoice || matchingVoices[0];
    } else {
      // No matching voice for this language!
      this.voice = null;
      console.warn(`No voice found for language: ${this.currentLanguage} (prefix ${targetPrefix}). Falling back to text-only mode.`);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.synth.cancel();
    }
  }

  // Returns true if audio was queued/played, false if falling back to text (no voice)
  public speak(text: string, priority: 'normal' | 'high' = 'normal'): boolean {
    if (this.isMuted) return true; // Pretend it played if muted
    
    // If no voice is available for the current language, fail gracefully so UI can fallback
    if (!this.voice) {
      return false; 
    }

    const now = Date.now();
    const lastTime = this.lastSpoken.get(text) || 0;

    if (now - lastTime < this.COOLDOWN_MS) {
      return true; // Skipping due to cooldown, but no fallback needed
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    // Set lang explicitly
    utterance.lang = this.voice.lang;
    
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (priority === 'high') {
      this.synth.cancel();
      this.synth.speak(utterance);
    } else {
      this.synth.speak(utterance);
    }

    this.lastSpoken.set(text, now);

    if (this.lastSpoken.size > 50) {
      const fiveMinsAgo = now - 5 * 60 * 1000;
      for (const [key, time] of this.lastSpoken.entries()) {
        if (time < fiveMinsAgo) {
          this.lastSpoken.delete(key);
        }
      }
    }
    
    return true;
  }

  public stop() {
    this.synth.cancel();
  }
}

export const speechCoach = new SpeechCoach();
