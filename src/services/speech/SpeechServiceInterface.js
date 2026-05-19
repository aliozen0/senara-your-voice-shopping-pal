/**
 * SpeechServiceInterface
 *  - startListening(onResult, onError): void
 *  - stopListening(): void
 *  - speak(text, onEnd): void
 *  - stopSpeaking(): void
 *  - isListening(): boolean
 *  - isSpeaking(): boolean
 *  - isSupported(): boolean
 */
export class SpeechServiceInterface {
  startListening(_onResult, _onError) { throw new Error("not implemented"); }
  stopListening() { throw new Error("not implemented"); }
  speak(_text, _onEnd) { throw new Error("not implemented"); }
  stopSpeaking() { throw new Error("not implemented"); }
  isListening() { return false; }
  isSpeaking() { return false; }
  isSupported() { return false; }
}
