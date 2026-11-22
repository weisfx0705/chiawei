"use strict";

{
  const lab = document.querySelector("#signal-lab");
  const sensitivity = lab.querySelector("#lab-sensitivity");
  const afOut = lab.querySelector("#lab-af-out");
  const muteMode = lab.querySelector("#lab-mute-mode");
  const muteSwitch = lab.querySelector("#lab-mute-switch");
  const feedback = lab.querySelector("#signal-feedback");
  const task = lab.querySelector("#signal-task");
  const scenarios = [...lab.querySelectorAll("[data-scene]")];
  const meters = ["tx", "rx", "rec"].map(name => ({
    bar: lab.querySelector("#" + name + "-meter"),
    text: lab.querySelector("#" + name + "-state")
  }));
  let mutePressed = false;

  function showMeter(meter, level, message, peak = false) {
    const percent = level === null ? 0 : Math.max(0, Math.min(100, (level + 48) / 48 * 100));
    meter.bar.style.setProperty("--level", percent + "%");
    meter.bar.dataset.peak = String(peak);
    meter.text.textContent = message;
  }

  function showSetting(input, output) {
    const value = Number(input.value);
    const text = (value > 0 ? "+" + value : String(value).replace("-", "−")) + " dB";
    output.value = text;
    input.setAttribute("aria-valuetext", text);
  }

  function render() {
    const receiverGain = Number(afOut.value);
    // The actor's loudest line has a fixed, illustrative input level.
    const input = 24 + Number(sensitivity.value);
    const txOverload = input > 0;
    const rf = !mutePressed || muteMode.value !== "rf";
    const af = rf && (!mutePressed || muteMode.value !== "af");
    // Lowering the receiver output cannot undo clipping at the transmitter.
    const received = Math.min(input, 0);
    const recorded = received + receiverGain - 12;
    const recorderOverload = recorded >= 0;
    let message = "目前電平有餘裕。保留這次試音的設定，再請演員走位試錄。";

    showSetting(sensitivity, lab.querySelector("#lab-sensitivity-value"));
    showSetting(afOut, lab.querySelector("#lab-af-value"));
    muteSwitch.setAttribute("aria-pressed", String(mutePressed));
    muteSwitch.textContent = mutePressed ? "MUTE 在靜音位置｜撥回" : "模擬 MUTE 撥到靜音";

    showMeter(meters[0], input, txOverload ? "AF PEAK · 過載" : "AF · 有訊號", txOverload);
    showMeter(meters[1], af ? received : null, "RF " + (rf ? "有" : "無") + " · AF " + (af ? "有" : "無"));
    const recordStatus = txOverload ? "子機送來的聲音已失真" : recorderOverload ? "錄音機 · 過載" : recorded < -30 ? "電平偏低" : "有聲音 · 留有餘裕";
    showMeter(meters[2], af ? recorded : null, af ? recordStatus : "無聲", af && (txOverload || recorderOverload));

    if (!rf) {
      message = "RF 和 AF 都沒了。撥桿目前切掉的是無線發射。試把 Mute Mode 設成 Disabled，再看一次母機。";
    } else if (!af) {
      message = "RF 還在，AF 和錄音機都沒聲音。試把 Mute Mode 設成 Disabled，讓演員碰到撥桿也不會靜音。";
    } else if (txOverload) {
      message = "子機的 AF PEAK 還在。母機 AF Out 即使往下調，錄到的聲音仍會失真。把子機 Sensitivity 往更負的 dB 值調。";
    } else if (input < -18) {
      message = "子機輸入太小。把 Sensitivity 往 0 dB 調一點，再請演員大聲試講。";
    } else if (receiverGain !== 0) {
      message = "子機電平已留有餘裕。先把母機 AF Out 回到 0 dB，再看錄音機輸入是否合適。";
    } else if (mutePressed) {
      message = "撥桿還在 MUTE 位置，母機仍有 RF 和 AF。Disabled 已停用撥桿的靜音功能。";
    }
    feedback.textContent = message;
  }

  for (const button of scenarios) {
    button.addEventListener("click", () => {
      const peak = button.dataset.scene === "peak";
      sensitivity.value = peak ? "-12" : "-30";
      afOut.value = "0";
      muteMode.value = peak ? "disabled" : "af";
      mutePressed = !peak;
      task.textContent = peak ? "把子機的 AF PEAK 降下來，讓母機的 AF Out 留在 0 dB。"
        : "演員剛碰到子機的 MUTE 撥桿。看母機的 RF 和 AF，試著讓撥桿留在原位也能收到聲音。";
      for (const item of scenarios) item.setAttribute("aria-pressed", String(item === button));
      render();
    });
  }
  sensitivity.addEventListener("input", render);
  afOut.addEventListener("input", render);
  muteMode.addEventListener("change", render);
  muteSwitch.addEventListener("click", () => {
    mutePressed = !mutePressed;
    render();
  });
  render();
  lab.hidden = false;

  const unlockLab = document.querySelector("#unlock-lab");
  const lockDisplay = unlockLab.querySelector("#lock-display");
  const lockNote = unlockLab.querySelector("#lock-note");
  const screens = ["🔒 已鎖定", "Locked", "Unlock?", "已暫時解鎖"];
  const prompts = ["試試用 SET 和方向鍵開啟選單。", "按 ▲ 或 ▼，叫出解鎖確認。",
    "按 SET 確認。", "可以進選單了。離開選單後，Auto Lock 會重新鎖定。"];
  const sequence = ["set", "arrow", "set"];
  let step = 0;
  for (const button of unlockLab.querySelectorAll("[data-lock-key]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.lockKey;
      if (key === "reset") step = 0;
      else if (key === sequence[step]) step++;
      lockDisplay.textContent = screens[step];
      lockNote.textContent = prompts[step];
    });
  }
  unlockLab.hidden = false;

  for (const link of document.querySelectorAll("[data-open-drill]")) {
    link.addEventListener("click", () => {
      document.querySelector('[data-drill="' + link.dataset.openDrill + '"]').click();
    });
  }
}
