// The typeface is installed with the project and served from it, so the site
// looks the same offline.
import "@fontsource-variable/hanken-grotesk";
import "./style.css";
import { TutorialProgress, UciEngine } from "./core/index";
import { createBrowserStorage } from "./platform/browserStorage";
import { createOnnxMoveClassifier } from "./platform/onnxMoveClassifier";
import { createStockfishTransport } from "./platform/stockfishWorker";
import { createPlayScreen } from "./ui/screens/playScreen";
import { createTutorialScreen } from "./ui/screens/tutorialScreen";

type ScreenName = "learn" | "play";

const app = document.querySelector<HTMLDivElement>("#app")!;

// ---------- Header with the two main sections ----------

const header = document.createElement("header");
header.className = "app-header";
const title = document.createElement("h1");
title.textContent = "VR Chess Academy";
const nav = document.createElement("nav");
nav.className = "app-nav";
header.append(title, nav);

// Both screens are built once and kept. Switching only hides one and shows
// the other, so a game in progress is still there when you come back.
const screens: Record<ScreenName, HTMLElement> = {
  learn: document.createElement("div"),
  play: document.createElement("div"),
};
const tabs: Record<ScreenName, HTMLButtonElement> = {
  learn: navButton("Learn", "learn"),
  play: navButton("Play", "play"),
};
nav.append(tabs.learn, tabs.play);
app.append(header, screens.learn, screens.play);

function navButton(label: string, name: ScreenName): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.addEventListener("click", () => show(name));
  return el;
}

function show(name: ScreenName): void {
  for (const key of Object.keys(screens) as ScreenName[]) {
    screens[key].hidden = key !== name;
    tabs[key].classList.toggle("active", key === name);
    tabs[key].setAttribute("aria-current", key === name ? "page" : "false");
  }
}

// ---------- Build the screens ----------

// main.ts is the one place that knows about the browser-only pieces. It
// builds the real engine and the real storage and hands them to the screens,
// which only ever see the interfaces from core/.
const engine = new UciEngine(createStockfishTransport());
const storage = createBrowserStorage();
const progress = new TutorialProgress(storage);

// The trained model that names the idea behind a move. It is only downloaded
// the first time a move is reviewed.
const classifier = createOnnxMoveClassifier();

const tutorial = createTutorialScreen(screens.learn, progress, { onPlay: () => show("play") });
createPlayScreen(screens.play, engine, storage, classifier, {
  onPracticeLesson: (lessonId: string) => {
    show("learn");
    tutorial.openLessonById(lessonId);
  },
});

// Someone who has never finished a lesson starts with the tutorial.
show(progress.completedCount() === 0 ? "learn" : "play");
