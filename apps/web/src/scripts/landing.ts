document.addEventListener("DOMContentLoaded", () => {
  // Tab Switching
  const tabBtns = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabContents = document.querySelectorAll<HTMLElement>(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      if (!targetId) return;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // Copy Code Action
  const btnCopyCode = document.getElementById("btn-copy-code");
  if (btnCopyCode) {
    btnCopyCode.addEventListener("click", async () => {
      const codeEl = document.querySelector(".terminal-code code");
      if (codeEl && navigator.clipboard) {
        await navigator.clipboard.writeText(codeEl.textContent || "");
        btnCopyCode.textContent = "Copied!";
        setTimeout(() => {
          btnCopyCode.textContent = "Copy All";
        }, 2500);
      }
    });
  }

  // Live Interactive Hero Simulation
  const btnSim = document.getElementById("btn-run-sim");
  const simBookLabel = document.getElementById("sim-book-label");
  const simPercent = document.getElementById("sim-percent");
  const simBar = document.getElementById("sim-bar");

  const simulationSteps = [
    { label: "Connecting to Kindle Cloud & Notion API...", pct: 15 },
    { label: "Discovering books: Found 8 books in library...", pct: 35 },
    { label: 'Syncing: "Designing Data-Intensive Applications"...', pct: 55 },
    { label: 'Syncing: "Atomic Habits" (18 highlights)...', pct: 78 },
    { label: 'Syncing: "Thinking, Fast and Slow"...', pct: 95 },
    { label: "✓ Sync complete! 142 highlights synchronized.", pct: 100 },
  ];

  let simIndex = 0;
  let isSimRunning = false;

  function runSimulationStep() {
    if (!isSimRunning || !simBookLabel || !simPercent || !simBar) return;

    const step = simulationSteps[simIndex];
    if (step) {
      simBookLabel.textContent = step.label;
      simPercent.textContent = `${step.pct}%`;
      simBar.style.width = `${step.pct}%`;

      simIndex++;
      if (simIndex < simulationSteps.length) {
        setTimeout(runSimulationStep, 900);
      } else {
        isSimRunning = false;
        if (btnSim) btnSim.removeAttribute("disabled");
      }
    }
  }

  if (btnSim) {
    btnSim.addEventListener("click", () => {
      if (isSimRunning) return;
      isSimRunning = true;
      simIndex = 0;
      btnSim.setAttribute("disabled", "true");
      runSimulationStep();
    });
  }
});
