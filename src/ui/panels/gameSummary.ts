import type {
  GameSummary,
  MoveReview,
  PieceType,
  RatingChange,
  RecommendedPractice,
} from "../../core/index";

export interface SummaryActions {
  onPlayAgain(): void;
  onInspectMistake?(review: MoveReview | null): void;
  onPracticeLesson?(lessonId: string): void;
}

const QUALITY_LABELS: Record<string, string> = {
  blunder: "Blunder",
  mistake: "Mistake",
  inaccuracy: "Inaccuracy",
};

const PIECE_SYMBOLS: Record<PieceType, string> = {
  king: "♚",
  queen: "♛",
  rook: "♜",
  bishop: "♝",
  knight: "♞",
  pawn: "♟",
};

/** The post-game feedback card: result, numbers, mistakes, strengths, and advice. */
export function createGameSummary(actions: SummaryActions) {
  const element = document.createElement("section");
  element.className = "summary";
  element.hidden = true;

  let currentInspected: MoveReview | null = null;

  return {
    element,
    /**
     * Shows the summary, or hides it when `summary` is null.
     * `pendingReviews` is how many moves the engine is still checking.
     * `inspectedReview` is the move currently being viewed on the board.
     */
    update(
      summary: GameSummary | null,
      pendingReviews: number,
      levelChange: RatingChange | null = null,
      inspectedReview: MoveReview | null = null,
    ): void {
      element.hidden = summary === null;
      if (!summary) return;

      currentInspected = inspectedReview;

      // 1. Heading & Performance Title
      const headerBox = document.createElement("div");
      headerBox.className = "summary-header-box";

      const heading = document.createElement("h2");
      heading.textContent = "Game summary";

      const titleBadge = document.createElement("span");
      titleBadge.className = "summary-badge";
      titleBadge.textContent = summary.performanceTitle;

      headerBox.append(heading, titleBadge);

      // 2. Result text
      const result = document.createElement("p");
      result.className = `summary-result result-${summary.result}`;
      result.textContent = summary.resultText;

      // 3. Move Quality & Accuracy Bar
      const meterBox = createAccuracyMeter(summary);

      // 4. Game Stats
      const stats = document.createElement("dl");
      stats.className = "summary-stats";
      stats.append(
        ...stat("Your moves", String(summary.playerMoves)),
        ...stat("Pieces you captured", `${summary.capturesByPlayer} (${summary.playerCapturesDetail.materialPoints} pts)`),
        ...stat("Pieces you lost", `${summary.capturesByOpponent} (${summary.opponentCapturesDetail.materialPoints} pts)`),
        ...stat("Material advantage", formatMaterialAdvantage(summary.netMaterialAdvantage)),
      );

      // 5. Captured pieces visual breakdown
      const captureTray = createCaptureTray(summary);

      // 6. Strengths (What you did well)
      const strengthsBox = document.createElement("div");
      strengthsBox.className = "summary-section";
      strengthsBox.append(subheading("What you did well"));
      const strengthsList = document.createElement("ul");
      strengthsList.className = "summary-strengths";
      for (const text of summary.strengths) {
        const li = document.createElement("li");
        li.textContent = text;
        strengthsList.append(li);
      }
      strengthsBox.append(strengthsList);

      const parts: HTMLElement[] = [headerBox, result, meterBox, stats, captureTray, strengthsBox];

      if (pendingReviews > 0) {
        const pending = document.createElement("p");
        pending.className = "summary-pending";
        pending.textContent = `Still analyzing ${plural(pendingReviews, "move")} with the engine…`;
        parts.push(pending);
      }

      // 7. Key Mistakes with Interactive Board Inspection
      if (summary.keyMistakes.length > 0) {
        const mistakesBox = document.createElement("div");
        mistakesBox.className = "summary-section";
        mistakesBox.append(subheading("Moves to learn from"));

        const list = document.createElement("ul");
        list.className = "summary-mistakes";
        for (const mistake of summary.keyMistakes) {
          list.append(mistakeItem(mistake, mistake === currentInspected, actions));
        }
        mistakesBox.append(list);
        parts.push(mistakesBox);
      }

      // 8. Phase Breakdown
      if (summary.phases.length > 0) {
        const phasesBox = document.createElement("div");
        phasesBox.className = "summary-section";
        phasesBox.append(subheading("Game phases"));
        const phasesList = document.createElement("ul");
        phasesList.className = "summary-phases";
        for (const phase of summary.phases) {
          const item = document.createElement("li");
          const phaseName = document.createElement("strong");
          phaseName.textContent = capitalize(phase.phase);
          const verdict = document.createElement("span");
          verdict.textContent = `${phase.moves} moves • ${phase.verdict}`;
          item.append(phaseName, verdict);
          phasesList.append(item);
        }
        phasesBox.append(phasesList);
        parts.push(phasesBox);
      }

      // 9. Recommendations for Next Game (with Tutorial links)
      const adviceBox = document.createElement("div");
      adviceBox.className = "summary-section";
      adviceBox.append(subheading("Recommended practice"));
      const adviceList = document.createElement("ul");
      adviceList.className = "summary-advice";

      const practices = summary.practiceRecommendations.length > 0
        ? summary.practiceRecommendations
        : summary.recommendations.map((text) => ({ text, reason: "" }));

      for (const practice of practices) {
        adviceList.append(adviceItem(practice, actions));
      }
      adviceBox.append(adviceList);
      parts.push(adviceBox);

      // 10. Adaptive level update (if applicable)
      if (levelChange) {
        const level = document.createElement("p");
        level.className = "summary-level";
        const moved =
          levelChange.after === levelChange.before
            ? `Level ${levelChange.after}`
            : `Level ${levelChange.before} → ${levelChange.after}`;
        level.textContent = `${moved}. ${levelChange.reason}`;
        parts.push(level);
      }

      // 11. Buttons: Play Again & Copy Report
      const actionsRow = document.createElement("div");
      actionsRow.className = "summary-actions-row";

      const again = document.createElement("button");
      again.type = "button";
      again.className = "primary";
      again.textContent = "Play again";
      again.addEventListener("click", actions.onPlayAgain);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "secondary";
      copyBtn.textContent = "Copy report";
      copyBtn.addEventListener("click", () => {
        const report = generateTextReport(summary);
        navigator.clipboard?.writeText(report).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy report";
          }, 2000);
        }).catch(() => {
          copyBtn.textContent = "Copied!";
        });
      });

      actionsRow.append(again, copyBtn);
      parts.push(actionsRow);

      element.replaceChildren(...parts);
    },
  };
}

function createAccuracyMeter(summary: GameSummary): HTMLElement {
  const container = document.createElement("div");
  container.className = "summary-accuracy-container";

  const labels = document.createElement("div");
  labels.className = "accuracy-labels";
  const pct = document.createElement("span");
  pct.className = "accuracy-percent";
  pct.textContent = summary.goodMovePercent === null ? "Move Quality" : `${summary.goodMovePercent}% Solid Moves`;

  const countsText = document.createElement("span");
  countsText.className = "accuracy-counts-text";
  const { blunder, mistake, inaccuracy } = summary.counts;
  countsText.textContent = `${plural(blunder, "blunder")}, ${plural(mistake, "mistake")}, ${plural(inaccuracy, "inaccuracy", "inaccuracies")}`;

  labels.append(pct, countsText);

  const bar = document.createElement("div");
  bar.className = "accuracy-bar";

  const total = summary.counts.good + summary.counts.inaccuracy + summary.counts.mistake + summary.counts.blunder;
  if (total > 0) {
    const goodSegment = document.createElement("div");
    goodSegment.className = "bar-segment segment-good";
    goodSegment.style.width = `${(summary.counts.good / total) * 100}%`;
    goodSegment.title = `${summary.counts.good} good moves`;

    const inaccSegment = document.createElement("div");
    inaccSegment.className = "bar-segment segment-inaccuracy";
    inaccSegment.style.width = `${(summary.counts.inaccuracy / total) * 100}%`;
    inaccSegment.title = `${summary.counts.inaccuracy} inaccuracies`;

    const mistSegment = document.createElement("div");
    mistSegment.className = "bar-segment segment-mistake";
    mistSegment.style.width = `${(summary.counts.mistake / total) * 100}%`;
    mistSegment.title = `${summary.counts.mistake} mistakes`;

    const blundSegment = document.createElement("div");
    blundSegment.className = "bar-segment segment-blunder";
    blundSegment.style.width = `${(summary.counts.blunder / total) * 100}%`;
    blundSegment.title = `${summary.counts.blunder} blunders`;

    bar.append(goodSegment, inaccSegment, mistSegment, blundSegment);
  }

  container.append(labels, bar);
  return container;
}

function createCaptureTray(summary: GameSummary): HTMLElement {
  const tray = document.createElement("div");
  tray.className = "summary-capture-tray";

  const capturedPieces = renderPiecesRow("You took", summary.playerCapturesDetail.byPiece);
  const lostPieces = renderPiecesRow("You lost", summary.opponentCapturesDetail.byPiece);

  tray.append(capturedPieces, lostPieces);
  return tray;
}

function renderPiecesRow(label: string, pieceCount: Record<PieceType, number>): HTMLElement {
  const row = document.createElement("div");
  row.className = "capture-row";
  const labelEl = document.createElement("span");
  labelEl.className = "capture-row-label";
  labelEl.textContent = label;

  const piecesEl = document.createElement("div");
  piecesEl.className = "capture-icons";

  const types: PieceType[] = ["queen", "rook", "bishop", "knight", "pawn"];
  let hasPieces = false;
  for (const t of types) {
    const count = pieceCount[t];
    if (count > 0) {
      hasPieces = true;
      const chip = document.createElement("span");
      chip.className = "piece-chip";
      chip.textContent = `${PIECE_SYMBOLS[t]}×${count}`;
      piecesEl.append(chip);
    }
  }

  if (!hasPieces) {
    const none = document.createElement("span");
    none.className = "piece-none";
    none.textContent = "None";
    piecesEl.append(none);
  }

  row.append(labelEl, piecesEl);
  return row;
}

function mistakeItem(review: MoveReview, isInspected: boolean, actions: SummaryActions): HTMLElement {
  const item = document.createElement("li");
  item.className = `mistake-card quality-${review.quality}${isInspected ? " is-inspected" : ""}`;

  const header = document.createElement("div");
  header.className = "mistake-header";

  const title = document.createElement("strong");
  title.textContent = `Move ${review.moveNumber}: ${review.san}`;

  const badge = document.createElement("span");
  badge.className = `quality-badge badge-${review.quality}`;
  badge.textContent = QUALITY_LABELS[review.quality] ?? review.quality;

  header.append(title, badge);

  const text = document.createElement("span");
  text.className = "mistake-explanation";
  text.textContent = review.explanation ?? "";

  const footer = document.createElement("div");
  footer.className = "mistake-footer";

  if (actions.onInspectMistake) {
    const inspectBtn = document.createElement("button");
    inspectBtn.type = "button";
    inspectBtn.className = isInspected ? "inspect-btn active" : "inspect-btn";
    inspectBtn.textContent = isInspected ? "Showing on board ✕" : "Inspect on board →";
    inspectBtn.addEventListener("click", () => {
      actions.onInspectMistake?.(isInspected ? null : review);
    });
    footer.append(inspectBtn);
  }

  item.append(header, text, footer);
  return item;
}

function adviceItem(practice: RecommendedPractice, actions: SummaryActions): HTMLElement {
  const item = document.createElement("li");
  item.className = "advice-card";

  const text = document.createElement("p");
  text.className = "advice-text";
  text.textContent = practice.text;
  item.append(text);

  if (practice.lessonId && actions.onPracticeLesson) {
    const lessonAction = document.createElement("div");
    lessonAction.className = "lesson-link-row";

    const lessonTag = document.createElement("span");
    lessonTag.className = "lesson-tag";
    lessonTag.textContent = `Lesson: ${practice.lessonTitle ?? practice.lessonId}`;

    const practiceBtn = document.createElement("button");
    practiceBtn.type = "button";
    practiceBtn.className = "practice-btn";
    practiceBtn.textContent = "Practice in tutorial →";
    practiceBtn.addEventListener("click", () => {
      actions.onPracticeLesson?.(practice.lessonId!);
    });

    lessonAction.append(lessonTag, practiceBtn);
    item.append(lessonAction);
  }

  return item;
}

function stat(label: string, value: string): HTMLElement[] {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value;
  return [term, detail];
}

function subheading(text: string): HTMLElement {
  const el = document.createElement("h3");
  el.textContent = text;
  return el;
}

function formatMaterialAdvantage(pts: number): string {
  if (pts > 0) return `+${pts} (Lead)`;
  if (pts < 0) return `${pts} (Deficit)`;
  return "Even (0)";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

function generateTextReport(summary: GameSummary): string {
  const lines: string[] = [
    `=== VR CHESS ACADEMY - PERFORMANCE REPORT ===`,
    `Result: ${summary.resultText}`,
    `Performance: ${summary.performanceTitle} (${summary.goodMovePercent ?? "–"}% solid moves)`,
    `Moves Played: ${summary.playerMoves}`,
    `Captures: ${summary.capturesByPlayer} taken (${summary.playerCapturesDetail.materialPoints} pts), ${summary.capturesByOpponent} lost (${summary.opponentCapturesDetail.materialPoints} pts)`,
    `Material Advantage: ${formatMaterialAdvantage(summary.netMaterialAdvantage)}`,
    `Errors: ${summary.counts.blunder} blunders, ${summary.counts.mistake} mistakes, ${summary.counts.inaccuracy} inaccuracies`,
    ``,
    `Key Strengths:`,
    ...summary.strengths.map((s) => `  * ${s}`),
    ``,
    `Moves to Learn From:`,
    ...summary.keyMistakes.map(
      (m) => `  * Move ${m.moveNumber} (${m.san}): ${QUALITY_LABELS[m.quality]} - ${m.explanation}`,
    ),
    ``,
    `Recommended Practice:`,
    ...summary.practiceRecommendations.map(
      (r) => `  * ${r.text}${r.lessonTitle ? ` [Lesson: ${r.lessonTitle}]` : ""}`,
    ),
  ];
  return lines.join("\n");
}
