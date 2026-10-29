// The public face of core/.
// ui/, modes/ and platform/ import from this file only, never from
// the folders inside core/.

export { GameReviewer } from "./analysis/gameReviewer";
export type { MistakeTheme, MoveQuality, MoveReview } from "./analysis/moveReview";
export { findCandidates, groupByCategory } from "./coach/candidates";
export type { Candidate, CandidateGroup, MoveCategory } from "./coach/candidates";
export { commentOn } from "./commenter/comment";
export type { CommentRating, MoveComment } from "./commenter/comment";
export { summariseGame } from "./feedback/summary";
export type {
  CaptureDetails,
  GameResult,
  GameSummary,
  PhaseBreakdown,
  PieceCount,
  RecommendedPractice,
} from "./feedback/summary";
export { describeThreat, findThreatenedPieces } from "./analysis/threats";
export type { Threat, ThreatKind } from "./analysis/threats";
export { findHint } from "./hints/hint";
export type { ArrowMark, Hint, HintReason, MarkKind, SquareMark } from "./hints/hint";
export { AdaptiveDifficulty, MAX_RATING } from "./difficulty/adaptive";
export type { RatingChange } from "./difficulty/adaptive";
export { getLevel, LEVELS } from "./difficulty/levels";
export type { DifficultyLevel, LevelId } from "./difficulty/levels";
export type {
  ChessEngine,
  EngineLine,
  EngineRequest,
  EngineResult,
  UciTransport,
} from "./engine/engine";
export { UciEngine } from "./engine/uciEngine";
export { Game } from "./game/game";
export { MoveSelector } from "./input/moveSelector";
export type { SelectionState } from "./input/moveSelector";
export { ENCODED_LENGTH, encodeMove, NUM_PLANES } from "./model/encodeMove";
export { interpretLogits } from "./model/moveClassifier";
export type { IdeaLabel, IdeaScore, ModelInfo, MoveClassifier, MoveIdeas } from "./model/moveClassifier";
export { ComputerOpponent } from "./opponent/computerOpponent";
export { TutorialProgress } from "./progress/progress";
export type { KeyValueStore } from "./progress/progress";
export { getLesson, LESSON_GROUPS, LESSONS } from "./tutorial/lessons";
export type { Lesson, LessonGroup, LessonId, LessonStep } from "./tutorial/lessons";
export { LessonSession } from "./tutorial/lessonSession";
export type { Feedback, LessonView } from "./tutorial/lessonSession";
export { isSquare } from "./types";
export type {
  Color,
  DrawReason,
  GameInput,
  GameStatus,
  MoveChoice,
  MoveRecord,
  MoveRejection,
  MoveResult,
  Piece,
  PieceType,
  Position,
  PositionListener,
  PromotionPiece,
  Square,
} from "./types";
