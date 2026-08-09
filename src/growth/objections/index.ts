export { ObjectionService } from "./service";
export { createMemoryObjectionStore } from "./memoryStore";
export {
  TAXONOMY_CODES,
  TAXONOMY_TAP_LABELS,
  EXIT_SURVEY_CHOICES,
  parseExitSurveyReply,
} from "./taxonomy";
export {
  answerExitSurvey,
  buildExitSurveyBody,
  dispatchExitSurveys,
} from "./exitSurvey";
export type {
  ObjectionRecord,
  TaxonomyMapping,
  TrendRow,
  LogObjectionInput,
  ObjectionCode,
} from "./types";
