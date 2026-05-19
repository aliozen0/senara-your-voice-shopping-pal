import { USE_MOCK } from "../config/index.js";
import { MockAIService } from "./ai/MockAIService.js";
import { GeminiService } from "./ai/GeminiService.js";
import { WebSpeechService } from "./speech/WebSpeechService.js";
import { MockSearchService } from "./search/MockSearchService.js";
import { ExtensionSearchService } from "./search/ExtensionSearchService.js";

let _ai, _speech, _search;

export const getAIService = () => {
  if (!_ai) _ai = USE_MOCK ? new MockAIService() : new GeminiService();
  return _ai;
};

export const getSpeechService = () => {
  if (!_speech) _speech = new WebSpeechService();
  return _speech;
};

export const getSearchService = () => {
  if (!_search) _search = USE_MOCK ? new MockSearchService() : new ExtensionSearchService();
  return _search;
};
