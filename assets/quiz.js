// Reusable quiz component.
// Markup:
// <div class="quiz">
//   <div class="q" data-answer="2" data-explain="Why the answer is right.">
//     <p>Question text</p>
//     <button>Option 0</button><button>Option 1</button><button>Option 2</button>
//   </div>
// </div>
// data-answer is the zero-based index of the correct button.
// Learners answer from memory first: feedback appears only after a choice.

(function () {
  const css = `
  .quiz .q { margin: 1.6rem 0; }
  .quiz .q > p { margin-bottom: 0.6rem; }
  .quiz button { display: block; width: 100%; text-align: left; font: inherit; font-size: 0.92rem;
    background: white; color: var(--ink); border: 1px solid var(--rule); border-radius: 4px;
    padding: 0.5rem 0.8rem; margin: 0.35rem 0; cursor: pointer; }
  .quiz button:hover:not([disabled]) { border-color: var(--ink); }
  .quiz button[disabled] { cursor: default; }
  .quiz button.right { border-color: var(--ok); background: #eef6ef; }
  .quiz button.wrong { border-color: var(--bad); background: #f8ecea; }
  .quiz .fb { font-size: 0.88rem; margin-top: 0.5rem; }
  .quiz .fb.ok b { color: var(--ok); } .quiz .fb.no b { color: var(--bad); }
  .quiz-score { font-style: italic; color: var(--muted); }`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  document.querySelectorAll(".quiz").forEach((quiz) => {
    const qs = [...quiz.querySelectorAll(".q")];
    let answered = 0, correct = 0;
    const score = document.createElement("p");
    score.className = "quiz-score";
    quiz.appendChild(score);

    qs.forEach((q) => {
      const answer = Number(q.dataset.answer);
      const buttons = [...q.querySelectorAll("button")];
      buttons.forEach((btn, i) => {
        btn.addEventListener("click", () => {
          buttons.forEach((b) => (b.disabled = true));
          const ok = i === answer;
          btn.classList.add(ok ? "right" : "wrong");
          buttons[answer].classList.add("right");
          const fb = document.createElement("p");
          fb.className = "fb " + (ok ? "ok" : "no");
          fb.innerHTML = `<b>${ok ? "Correct." : "Not quite."}</b> ${q.dataset.explain || ""}`;
          q.appendChild(fb);
          answered++; if (ok) correct++;
          if (answered === qs.length) score.textContent = `Score: ${correct} / ${qs.length}. Revisit this quiz in a few days without rereading the lesson.`;
        });
      });
    });
  });
})();
