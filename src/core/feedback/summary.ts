import type { MistakeTheme, MoveReview } from "../analysis/moveReview";
import type { Color, MoveRecord, PieceType, Position } from "../types";

export type GameResult = "win" | "loss" | "draw";

export type PieceCount = Record<PieceType, number>;

/** Detailed breakdown of pieces captured during the game. */
export interface CaptureDetails {
  total: number;
  byPiece: PieceCount;
  materialPoints: number;
}

/** Actionable recommendation with an optional direct link to a tutorial lesson. */
export interface RecommendedPractice {
  /** The advice text. */
  text: string;
  /** Matching lesson ID from the tutorial (e.g. "fork", "back-rank-mate", "italian-game"). */
  lessonId?: string;
  /** Human-readable title of the lesson. */
  lessonTitle?: string;
  /** Why this specific practice was recommended. */
  reason: string;
}

/** Evaluation of performance across individual phases of the game. */
export interface PhaseBreakdown {
  phase: "opening" | "middlegame" | "endgame";
  moves: number;
  blunders: number;
  mistakes: number;
  verdict: string;
}

/** Everything the post-game feedback screen shows. */
export interface GameSummary {
  result: GameResult;
  /** One sentence saying how the game ended. */
  resultText: string;
  /** How many moves the player made. */
  playerMoves: number;
  /** Enemy pieces the player captured, and pieces the player lost. */
  capturesByPlayer: number;
  capturesByOpponent: number;
  /** How many of the player's reviewed moves fell into each group. */
  counts: { good: number; inaccuracy: number; mistake: number; blunder: number };
  /** Share of reviewed moves that were good, 0 to 100. Null if none were reviewed. */
  goodMovePercent: number | null;
  /** The costliest errors, worst first. */
  keyMistakes: MoveReview[];
  /** Advice for the next game (plain text strings for compatibility). */
  recommendations: string[];

  // --- Enhanced Module 3 Features ---
  /** Detailed piece breakdown and points won. */
  playerCapturesDetail: CaptureDetails;
  /** Detailed piece breakdown and points lost. */
  opponentCapturesDetail: CaptureDetails;
  /** Net material advantage (positive means player won more piece value). */
  netMaterialAdvantage: number;
  /** Rich actionable recommendations with direct links to tutorial lessons. */
  practiceRecommendations: RecommendedPractice[];
  /** Encouraging positive highlights from the player's game. */
  strengths: string[];
  /** Progression breakdown across opening, middlegame, and endgame. */
  phases: PhaseBreakdown[];
  /** Beginner-friendly title reflecting overall play quality. */
  performanceTitle: string;
}

/** How many mistakes are listed in full. More than this is too much to take in. */
const MAX_KEY_MISTAKES = 3;
const MAX_RECOMMENDATIONS = 3;

/** By this move a beginner should normally have castled. */
const CASTLE_BY_MOVE = 12;

export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

function emptyPieceRecord(): PieceCount {
  return { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 };
}

function summarizeCaptures(moves: MoveRecord[]): CaptureDetails {
  const byPiece = emptyPieceRecord();
  let materialPoints = 0;
  let total = 0;

  for (const move of moves) {
    if (move.captured) {
      byPiece[move.captured]++;
      materialPoints += PIECE_VALUES[move.captured] ?? 0;
      total++;
    }
  }

  return { total, byPiece, materialPoints };
}

function describeResult(position: Position, result: GameResult): string {
  if (position.status === "checkmate") {
    return result === "win" ? "You won by checkmate." : "You lost by checkmate.";
  }
  if (position.status === "stalemate") {
    return "Draw by stalemate: the player to move had no legal move but was not in check.";
  }
  switch (position.drawReason) {
    case "insufficient-material":
      return "Draw: neither side had enough pieces left to give checkmate.";
    case "threefold-repetition":
      return "Draw: the same position appeared three times.";
    default:
      return "Draw: fifty moves passed without a capture or a pawn move.";
  }
}

/**
 * Builds the post-game summary from the final position and the move reviews.
 * Call it once the game is over.
 */
export function summariseGame(position: Position, reviews: MoveReview[], playerColor: Color): GameSummary {
  const result: GameResult =
    position.status === "checkmate" ? (position.winner === playerColor ? "win" : "loss") : "draw";

  const myMoves = position.history.filter((move) => move.color === playerColor);
  const theirMoves = position.history.filter((move) => move.color !== playerColor);

  const playerCapturesDetail = summarizeCaptures(myMoves);
  const opponentCapturesDetail = summarizeCaptures(theirMoves);
  const netMaterialAdvantage = playerCapturesDetail.materialPoints - opponentCapturesDetail.materialPoints;

  const counts = { good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const review of reviews) {
    if (review.quality === "best" || review.quality === "good") counts.good++;
    else counts[review.quality]++;
  }

  const goodMovePercent = reviews.length > 0 ? Math.round((counts.good / reviews.length) * 100) : null;

  const errors = reviews.filter((review) => review.theme !== null);
  const keyMistakes = [...errors]
    // Inaccuracies are small; the list is for mistakes and blunders.
    .filter((review) => review.quality !== "inaccuracy")
    .sort((a, b) => b.lossCp - a.lossCp)
    .slice(0, MAX_KEY_MISTAKES);

  const castled = myMoves.some((move) => move.isCastle);
  const practiceRecommendations = recommendPractice({
    result,
    errors,
    counts,
    castled,
    playerMoves: myMoves.length,
  });

  const strengths = detectStrengths(
    result,
    position,
    myMoves,
    counts,
    goodMovePercent,
    playerCapturesDetail,
    netMaterialAdvantage,
    reviews,
  );

  const phases = analyzePhases(myMoves, reviews);
  const performanceTitle = derivePerformanceTitle(goodMovePercent, counts.blunder);

  return {
    result,
    resultText: describeResult(position, result),
    playerMoves: myMoves.length,
    capturesByPlayer: playerCapturesDetail.total,
    capturesByOpponent: opponentCapturesDetail.total,
    counts,
    goodMovePercent,
    keyMistakes,
    recommendations: practiceRecommendations.map((r) => r.text),
    playerCapturesDetail,
    opponentCapturesDetail,
    netMaterialAdvantage,
    practiceRecommendations,
    strengths,
    phases,
    performanceTitle,
  };
}

interface AdviceInput {
  result: GameResult;
  errors: MoveReview[];
  counts: GameSummary["counts"];
  castled: boolean;
  playerMoves: number;
}

/**
 * Chooses advice from fixed rules with paired tutorial lessons.
 */
function recommendPractice(input: AdviceInput): RecommendedPractice[] {
  const { result, errors, counts, castled, playerMoves } = input;
  const times = (theme: MistakeTheme) => errors.filter((review) => review.theme === theme).length;
  const items: RecommendedPractice[] = [];

  if (times("allowed-mate") > 0) {
    items.push({
      text: "Before you move, ask what your opponent's most dangerous reply would be, especially any check on your king.",
      lessonId: "back-rank-mate",
      lessonTitle: "The back-rank mate",
      reason: "Learn to recognize forced mating nets and defend against king attacks.",
    });
  }
  if (times("missed-mate") > 0) {
    items.push({
      text: "When the enemy king has few squares to run to, look at every check you can give. One of them may be checkmate.",
      lessonId: "queen-mate",
      lessonTitle: "Mate with king and queen",
      reason: "Practice coordinating pieces to deliver decisive checkmates.",
    });
  }
  if (times("hung-piece") >= 2) {
    items.push({
      text: "You left pieces where they could be captured more than once. Before each move, check that the piece you move, and the pieces it was protecting, are still safe.",
      lessonId: "queen",
      lessonTitle: "The queen",
      reason: "Review how vulnerable high-value pieces are when left undefended.",
    });
  } else if (times("hung-piece") === 1) {
    items.push({
      text: "Before each move, check that none of your pieces can be captured for free.",
      lessonId: "rook",
      lessonTitle: "The rook",
      reason: "Practice keeping pieces protected on open ranks and files.",
    });
  }
  if (times("missed-capture") >= 1) {
    items.push({
      text: "Look at every capture you can make before choosing a move. A free piece is usually the best move on the board.",
      lessonId: "fork",
      lessonTitle: "The fork",
      reason: "Train your tactical eye to spot double attacks and winning captures.",
    });
  }
  if (!castled && playerMoves >= CASTLE_BY_MOVE) {
    items.push({
      text: "You did not castle this game. Castling early keeps your king safe and brings a rook into play.",
      lessonId: "italian-game",
      lessonTitle: "The Italian Game",
      reason: "Master fundamental opening principles: develop pieces and castle early.",
    });
  }

  const seriousErrors = counts.mistake + counts.blunder;
  if (items.length === 0) {
    if (result === "win" && seriousErrors === 0) {
      items.push({
        text: "A clean win with no serious mistakes. You are ready to try a harder opponent.",
        lessonId: "queens-gambit",
        lessonTitle: "The Queen's Gambit",
        reason: "Take your game further by exploring sound opening structures.",
      });
    } else if (seriousErrors === 0) {
      items.push({
        text: "You made no serious mistakes. Keep playing to build experience, and use the hint button when you are unsure.",
        lessonId: "pin",
        lessonTitle: "The pin",
        reason: "Expand your tactical knowledge with the power of pins.",
      });
    } else {
      items.push({
        text: "Take your time on each move. Use the hint button when you are unsure, and read why the move is good.",
        lessonId: "fork",
        lessonTitle: "The fork",
        reason: "Study how attacking two pieces at once forces a decisive advantage.",
      });
    }
  }

  return items.slice(0, MAX_RECOMMENDATIONS);
}

function detectStrengths(
  result: GameResult,
  position: Position,
  myMoves: MoveRecord[],
  counts: GameSummary["counts"],
  goodPercent: number | null,
  playerCaptures: CaptureDetails,
  netAdvantage: number,
  reviews: MoveReview[],
): string[] {
  const strengths: string[] = [];
  const castledMoveIndex = myMoves.findIndex((m) => m.isCastle);

  if (castledMoveIndex !== -1) {
    strengths.push(`Castled early (move ${castledMoveIndex + 1}) to secure your king.`);
  }

  if (counts.blunder === 0 && reviews.length >= 3) {
    strengths.push("Zero blunders played: disciplined and cautious moves.");
  }

  if (playerCaptures.byPiece.queen > 0) {
    strengths.push("Captured the opponent's Queen.");
  } else if (netAdvantage >= 3) {
    strengths.push(`Achieved a solid material lead (+${netAdvantage} points).`);
  }

  if (goodPercent !== null && goodPercent >= 75) {
    strengths.push(`High accuracy: ${goodPercent}% of your moves were solid.`);
  }

  if (result === "win" && position.status === "checkmate") {
    strengths.push("Executed a decisive checkmate.");
  }

  if (strengths.length === 0) {
    if (result === "win") {
      strengths.push("Maintained control to seal the victory.");
    } else {
      strengths.push("Resilient play throughout the full game against the AI.");
    }
  }

  return strengths.slice(0, 3);
}

function analyzePhases(myMoves: MoveRecord[], reviews: MoveReview[]): PhaseBreakdown[] {
  const reviewsByMoveNum = new Map<number, MoveReview>();
  for (const r of reviews) {
    reviewsByMoveNum.set(r.moveNumber, r);
  }

  const phases: PhaseBreakdown[] = [];

  // Opening: moves 1..8
  const openingMoves = Math.min(myMoves.length, 8);
  if (openingMoves > 0) {
    let blunders = 0;
    let mistakes = 0;
    for (let m = 1; m <= openingMoves; m++) {
      const r = reviewsByMoveNum.get(m);
      if (r?.quality === "blunder") blunders++;
      if (r?.quality === "mistake") mistakes++;
    }
    phases.push({
      phase: "opening",
      moves: openingMoves,
      blunders,
      mistakes,
      verdict:
        blunders === 0 && mistakes === 0
          ? "Solid opening: clean piece development"
          : blunders > 0
            ? "Vulnerable opening: watch out for early piece safety"
            : "Decent opening with minor inaccuracies",
    });
  }

  // Middlegame: moves 9..20
  if (myMoves.length > 8) {
    const middleMoves = Math.min(myMoves.length, 20) - 8;
    let blunders = 0;
    let mistakes = 0;
    for (let m = 9; m <= Math.min(myMoves.length, 20); m++) {
      const r = reviewsByMoveNum.get(m);
      if (r?.quality === "blunder") blunders++;
      if (r?.quality === "mistake") mistakes++;
    }
    phases.push({
      phase: "middlegame",
      moves: middleMoves,
      blunders,
      mistakes,
      verdict:
        blunders === 0
          ? "Sharp middlegame: strong tactical defense"
          : "Complex middlegame: active piece battles",
    });
  }

  // Endgame: moves 21+
  if (myMoves.length > 20) {
    const endMoves = myMoves.length - 20;
    let blunders = 0;
    let mistakes = 0;
    for (let m = 21; m <= myMoves.length; m++) {
      const r = reviewsByMoveNum.get(m);
      if (r?.quality === "blunder") blunders++;
      if (r?.quality === "mistake") mistakes++;
    }
    phases.push({
      phase: "endgame",
      moves: endMoves,
      blunders,
      mistakes,
      verdict:
        blunders === 0
          ? "Controlled endgame technique"
          : "Endgame pressure: stay attentive with pawns and king",
    });
  }

  return phases;
}

function derivePerformanceTitle(goodPercent: number | null, blunders: number): string {
  if (goodPercent === null) return "Game Completed";
  if (goodPercent >= 85 && blunders === 0) return "Masterful Performance";
  if (goodPercent >= 70 && blunders <= 1) return "Sharp & Tactical Play";
  if (goodPercent >= 55) return "Solid Beginner Effort";
  if (goodPercent >= 40) return "Developing Game";
  return "Learning Fundamentals";
}
