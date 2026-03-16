export class VoiceUtils {
  private static teluguDigits: string[] = [
    "సున్నా", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది"
  ];

  private static teluguTens: string[] = [
    "", "పది", "ఇరవై", "ముప్పై", "నలభై", "యాభై", "అరవై", "డెబ్బై", "ఎనభై", "తొంభై"
  ];

  private static teluguTeens: string[] = [
    "పది", "పదకొండు", "పన్నెండు", "పదమూడు", "పదునాలుగు", "పదిహేను", "పదహారు", "పదిహేడు", "పద్ధెనిమిది", "పందొమ్మిది"
  ];

  /**
   * Returns the Telugu name for a number between 1 and 90.
   */
  public static getTeluguNumberName(num: number): string {
    if (num < 1 || num > 90) return "";

    if (num < 10) {
      return this.teluguDigits[num];
    }

    if (num >= 10 && num <= 19) {
      return this.teluguTeens[num - 10];
    }

    const tens = Math.floor(num / 10);
    const units = num % 10;

    if (units === 0) {
      return this.teluguTens[tens];
    }

    return `${this.teluguTens[tens]} ${this.teluguDigits[units]}`;
  }

  /**
   * Returns the individual digits in Telugu for a number.
   * e.g., 12 -> "ఒకటి రెండు"
   */
  /**
   * Returns the individual digits in Telugu for a number.
   * e.g., 12 -> "ఒకటి రెండు"
   */
  public static getTeluguDigits(num: number): string {
    const text = num.toString();
    return text.split('').map(digit => this.teluguDigits[parseInt(digit, 10)]).join(' ');
  }

  /**
   * Promise that resolves when voices are loaded.
   */
  public static waitForVoices(): Promise<void> {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve();
        return;
      }
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
        resolve();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      // Fallback for browsers that don't fire voiceschanged if already loaded
      setTimeout(resolve, 1000);
    });
  }

  /**
   * Finds the best available Telugu voice.
   */
  public static getTeluguVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Common Telugu lang codes
    const teluguLangs = ['te-IN', 'te_IN', 'te'];
    
    // 1st Priority: Exact lang match or starts with 'te'
    let voice = voices.find(v => teluguLangs.includes(v.lang) || v.lang.startsWith('te'));
    
    // 2nd Priority: Name contains "Telugu" or "Google" + "te"
    if (!voice) {
      voice = voices.find(v => v.name.toLowerCase().includes('telugu'));
    }

    return voice || null;
  }

  /**
   * Logs available voices for debugging.
   */
  public static logAvailableVoices() {
    const voices = window.speechSynthesis.getVoices();
    console.log(`[VoiceUtils] Found ${voices.length} voices.`);
    
    const teVoice = this.getTeluguVoice();
    if (teVoice) {
      console.log(`[VoiceUtils] Selected Telugu Voice: "${teVoice.name}" (${teVoice.lang})`);
    } else {
      console.warn("[VoiceUtils] No Telugu voice found. OS may need Telugu Speech Pack installed.");
    }
  }
}
