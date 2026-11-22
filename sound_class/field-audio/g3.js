"use strict";

const exercises = [
  {
    screen: "準備掃頻", detail: "第一組使用中，第二組的發射器（子機）已開機",
    question: "掃描前，先關哪一支？",
    choices: [
      ["把現場的發射器（子機）全部關掉", "已在工作的那組要繼續發射，才能掃到它佔用的頻道。"],
      ["只關第二組的發射器（子機）", "正確。已在工作的第一組保持開機。", true]
    ]
  },
  {
    screen: "Easy Setup", detail: "第二組的接收器（母機）已開機",
    question: "哪個選項會重新掃描？",
    choices: [
      ["Scan New List", "正確。接著選可用頻道。", true],
      ["Current List", "這是上一次的掃描結果。"]
    ]
  },
  {
    screen: "Frequency Preset", detail: "第一組 B03／Ch01，Ch02 可用",
    question: "第二組存在哪個頻道？",
    choices: [
      ["Bank 03 ／ Channel 01", "Ch01 已被第一組使用。"],
      ["Bank 03 ／ Channel 02", "正確。同一原廠 Bank，各用一個空 Channel。", true]
    ]
  },
  {
    screen: "B03 / Ch02 · Stored", detail: "接收器（母機）已儲存頻道",
    question: "怎麼把頻率傳給發射器（子機）？",
    choices: [
      ["打開發射器（子機），在接收器（母機）選 Sync，對準紅外線窗", "同步完成。開口看 AF，再試錄回放。", true],
      ["提高接收器（母機）的 AF Out", "AF Out 調的是輸出音量。"]
    ]
  }
];

const answers = document.querySelector("#answers");
const note = document.querySelector("#quiz-note");
const advance = document.querySelector("#advance");
let current = 0;
let solved = false;

function renderStep(focusAnswer = false) {
  const step = exercises[current];
  solved = false;
  document.querySelector("#step-count").textContent = String(current + 1).padStart(2, "0") + " / 04";
  document.querySelector("#lcd-title").textContent = step.screen;
  document.querySelector("#lcd-detail").textContent = step.detail;
  document.querySelector("#quiz-prompt").textContent = step.question;
  answers.replaceChildren();
  advance.hidden = true;
  note.textContent = "";
  note.className = "quiz-note";
  for (const [label, feedback, correct] of step.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (solved) return;
      note.textContent = feedback;
      note.className = correct ? "quiz-note success" : "quiz-note retry";
      if (!correct) {
        button.classList.add("tried");
        return;
      }
      solved = true;
      button.classList.add("correct");
      for (const choice of answers.children) choice.setAttribute("aria-disabled", "true");
      if (current === exercises.length - 1) {
        document.querySelector("#lcd-title").textContent = "Sync ✓";
      } else {
        advance.hidden = false;
      }
    });
    answers.append(button);
  }
  if (focusAnswer) answers.firstElementChild.focus({preventScroll: true});
}
advance.addEventListener("click", () => {
  if (solved && current < exercises.length - 1) {
    current++;
    renderStep(true);
  }
});
document.querySelector("#restart").addEventListener("click", () => {
  current = 0;
  renderStep(true);
});

const manual = document.querySelector("#manual-drill");
const auto = document.querySelector("#auto-drill");
const drillButtons = [...document.querySelectorAll("[data-drill]")];
for (const button of drillButtons) {
  button.addEventListener("click", () => {
    const isManual = button.dataset.drill === "manual";
    manual.hidden = !isManual;
    auto.hidden = isManual;
    document.querySelector("#practice-hint").textContent = isManual
      ? "接收器（母機）已設好。用發射器（子機）的按鍵調到同一頻率。"
      : "第一組已在工作。現在替第二位演員找一個空頻道。";
    for (const choice of drillButtons) choice.setAttribute("aria-pressed", String(choice === button));
  });
}

const mhzDigits = document.querySelector("#tune-mhz");
const khzDigits = document.querySelector("#tune-khz");
const tuneNote = document.querySelector("#tune-note");
const down = document.querySelector("#tune-down");
const up = document.querySelector("#tune-up");
const targetKHz = 538150;
const initialKHz = 537100;
let frequencyKHz = initialKHz;
let editPart = "ready";

function candidate(direction) {
  const wholeMHz = Math.floor(frequencyKHz / 1000);
  if (editPart === "mhz") {
    return Math.max(516000, Math.min(558000, frequencyKHz + direction * 1000));
  }
  if (editPart === "khz") {
    const floor = wholeMHz * 1000;
    const ceiling = Math.min(floor + 975, 558000);
    return Math.max(floor, Math.min(ceiling, frequencyKHz + direction * 25));
  }
  return frequencyKHz;
}

function showFrequency() {
  mhzDigits.textContent = Math.floor(frequencyKHz / 1000);
  khzDigits.textContent = String(frequencyKHz % 1000).padStart(3, "0");
  mhzDigits.classList.toggle("editing", editPart === "mhz");
  khzDigits.classList.toggle("editing", editPart === "khz");
  down.disabled = candidate(-1) === frequencyKHz;
  up.disabled = candidate(1) === frequencyKHz;
}

function selectPart(part) {
  editPart = part;
  const matched = frequencyKHz === targetKHz;
  const instructions = {
    ready: "按 SET 開始調 MHz。",
    mhz: "▲▼ 調整整數 MHz，按 SET 換下一欄。",
    khz: "▲▼ 調整小數，每格 25 kHz。按 SET 儲存。",
    stored: matched ? "Stored ✓　兩台同頻，現在可以試音。" : "Stored　兩台頻率不同，按 SET 重調。"
  };
  tuneNote.textContent = instructions[part];
  tuneNote.className = "quiz-note";
  if (part === "stored") tuneNote.classList.add(matched ? "success" : "retry");
  showFrequency();
}

down.addEventListener("click", () => { frequencyKHz = candidate(-1); showFrequency(); });
up.addEventListener("click", () => { frequencyKHz = candidate(1); showFrequency(); });
document.querySelector("#tune-set").addEventListener("click", () => {
  const next = {ready: "mhz", mhz: "khz", khz: "stored", stored: "mhz"};
  selectPart(next[editPart]);
});
document.querySelector("#tune-reset").addEventListener("click", () => {
  frequencyKHz = initialKHz;
  selectPart("ready");
});
renderStep();
selectPart("ready");
