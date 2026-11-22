"use strict";

const exercises = [
  {
    screen: "準備掃描",
    detail: "第一組使用中 · 第二支 SK 已開機",
    question: "第二支 SK 在你手上，應先怎麼做？",
    choices: [
      ["關閉所有正在使用的無線系統", "保留已在工作的第一組，掃描才看得到它佔用的頻道。"],
      ["只關閉待配對的第二支 SK", "正確。讓使用中的系統繼續發射，再由第二台 EK 掃描現場。", true]
    ]
  },
  {
    screen: "Easy Setup",
    detail: "第二支 SK 已關機 · 第二台 EK 已開機",
    question: "哪個功能會重新掃描當下的拍攝地點？",
    choices: [
      ["Scan New List", "正確。新的掃描會找出此地現在可用的預設頻道。", true],
      ["Current List", "Current List 顯示上一次的結果。換場後，請重新掃描。"]
    ]
  },
  {
    screen: "Frequency Preset",
    detail: "第一組 B03 / Ch01 · 掃描顯示 B03 / Ch02 可用",
    question: "兩組頻段相容的 G3 同時工作，你要把第二組存在哪裡？",
    choices: [
      ["Bank 03 ／ Channel 01", "第一位演員已在這個 Channel 發射，兩支同頻會相互干擾。"],
      ["Bank 03 ／ Channel 02", "正確。同一個原廠 Bank，分開使用空 Channel。按 SET 儲存。", true]
    ]
  },
  {
    screen: "B03 / Ch02 · Stored",
    detail: "第二組 EK 已儲存頻道 · 準備同步",
    question: "設定已存在 EK 裡。接著怎麼交給第二支 SK？",
    choices: [
      ["開啟 SK，在 EK 選 Sync，對準兩台 IR 窗", "同步完成 ✓。核對頻率、看 RF，開口看 AF，再從錄音機試錄回放。", true],
      ["提高 EK 的 AF Out，等待兩台自動配對", "AF Out 調整有線輸出音量。傳送頻道設定要靠 Sync 和紅外線。"]
    ]
  }
];

const answers = document.querySelector("#answers");
const note = document.querySelector("#quiz-note");
const advance = document.querySelector("#advance");
const restart = document.querySelector("#restart");
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
  note.textContent = "選擇你在現場會做的操作。";
  note.className = "quiz-note";
  for (const [label, feedback, correct] of step.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (solved) return;
      note.textContent = feedback;
      note.className = correct ? "quiz-note success" : "quiz-note retry";
      if (correct) {
        solved = true;
        button.classList.add("correct");
        for (const choice of answers.children) choice.setAttribute("aria-disabled", "true");
        if (current === exercises.length - 1) {
          document.querySelector("#lcd-title").textContent = "Sync ✓";
          document.querySelector("#lcd-detail").textContent = "第二組對頻完成 · 接著試錄走位";
        } else {
          advance.hidden = false;
        }
      } else {
        button.classList.add("tried");
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
restart.addEventListener("click", () => {
  current = 0;
  renderStep(true);
});
renderStep();
