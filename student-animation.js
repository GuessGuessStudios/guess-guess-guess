// =====================================================
// Student image-state animation
// Presentation only: gameplay emits semantic events.
// =====================================================

(() => {
  // Static artwork uses the same guess events without playing animation frames.
  if (document.body.dataset.staticStudents === "true") {
    const speech = Object.fromEntries(
      ["One", "Two", "Three", "Four"].map((word, index) => [
        `character${index + 1}`, document.getElementById(`character${word}Speech`),
      ])
    );
    function reportDisplayed(character, element) {
      if (!/(?:^\?|&)humanPlaytestMode=1(?:&|$)/.test(location.search) || !/(?:^\?|&)situationPilot=1(?:&|$)/.test(location.search)) return;
      window.GGGGameplayLogger?.observe('guess-displayed', { actor: character, isAi: character !== 'human', displayedGuess: element.textContent });
    }
    let speechTimer;
    let speechGeneration = 0;
    function hideSpeech() {
      speechGeneration++;
      clearTimeout(speechTimer);
      Object.values(speech).forEach((bubble) => {
        bubble.textContent = "";
        bubble.classList.remove("visible");
      });
    }
    document.addEventListener("ggg:student-reset", hideSpeech);
    document.addEventListener("ggg:student-guess", (event) => {
      const { character = "character1", guess, result, displayDuration } = event.detail || {};
      if (!guess || !speech[character] || (result !== "correct" && result !== "incorrect")) return;
      hideSpeech();
      speech[character].textContent = guess;
      speech[character].classList.add("visible");
      reportDisplayed(character, speech[character]);

      const owner = speechGeneration;
      speechTimer = setTimeout(() => {
        if (owner === speechGeneration) hideSpeech();
      }, Number.isFinite(displayDuration) ? displayDuration : globalThis.GGGGameplaySpeed.snapshot().duration(2000, "speech"));
      queueMicrotask(() => {
        if (owner !== speechGeneration) return;
        document.dispatchEvent(new CustomEvent("ggg:student-turn-complete", {
          detail: { character, guess, result },
        }));
      });
    });
    return;
  }

  const TIMING = Object.freeze({
    thinking: 2000,
    handRaised: 750,
    handToTeacher: 300,
    teacherSpeaking: 1000,
    teacherToStudent: 300,
    wordLocation: 1200,
    speaking: 2000,
    correctWatcherDelay: 250,
    correct: 1000,
    correctJoinDelay: 500,
    incorrect: 1000,
    frame: 220,
  });

  // This adapter belongs to the current presentation. The speed policy does not.
  function animationTiming(setting) {
    const snapshot = globalThis.GGGGameplaySpeed.snapshot(setting);
    return { ...Object.fromEntries(Object.entries(TIMING).map(([key, baseline]) =>
      [key, snapshot.duration(baseline, key === "frame" ? "animationFrame" : key === "speaking" ? "speech" : key === "correct" ? "animationCycle" : "animationPhase")])),
      maxTesting: snapshot.setting.mode === "max-testing" };
  }

  const STUDENTS = Object.freeze({
    character1: Object.freeze({
      name: "Character 1",
      seat: 1,
      imageRoot: "assets/images/Character One Images Folder",
      imageElementId: "characterOneImage",
      speechElementId: "characterOneSpeech",
      imageFiles: Object.freeze([
        "Character01_Image01.png",
        "Character01_Image02.png",
        "Character01_Image03.png",
        "Character01_Image04.png",
        "Character01_Image05.png",
        "Character01_Image06.png",
        "Character01_Image07.png",
        "Character01_Image08.png",
        "Character01_Image09.png",
        "Character01_Image10.png",
        "Character01_Image11.png",
        "Character01_Image12.png",
        "Character01_Image13.png",
      ]),
      states: Object.freeze({
        idle: ["Character01_Image01.png", "Character 1 sitting idle"],
        thinking: ["Character01_Image01.png", "Character 1 thinking"],
        incorrect: ["Character01_Image07.png", "Character 1 reacting to an incorrect answer"],
        watching: ["Character01_Image08.png", "Character 1 watching another student"],
        watchingOpposite: ["Character01_Image11.png", "Character 1 watching another student on the opposite side"],
      }),
      guessFrames: Object.freeze([
        "Character01_Image02.png",
        "Character01_Image03.png",
        "Character01_Image04.png",
      ]),
      correctFrames: Object.freeze([
        "Character01_Image05.png",
        "Character01_Image06.png",
      ]),
      sideApplauseFrames: Object.freeze([
        "Character01_Image09.png",
        "Character01_Image10.png",
      ]),
      oppositeApplauseFrames: Object.freeze([
        "Character01_Image12.png",
        "Character01_Image13.png",
      ]),
    }),

    character2: Object.freeze({
      name: "Character 2",
      seat: 2,
      imageRoot: "assets/images/Character Two Images Folder",
      imageElementId: "characterTwoImage",
      speechElementId: "characterTwoSpeech",
      imageFiles: Object.freeze([
        "Character02_Image01.png",
        "Character02_Image02.png",
        "Character02_Image03.png",
        "Character02_Image04.png",
        "Character02_Image05.png",
        "Character02_Image06.png",
        "Character02_Image07.png",
        "Character02_Image08.png",
        "Character02_Image09.png",
        "Character02_Image10.png",
        "Character02_Image11.png",
        "Character02_Image12.png",
        "Character02_Image13.png",
        "Character02_Image14.png",
      ]),
      states: Object.freeze({
        idle: ["Character02_Image01.png", "Character 2 sitting idle"],
        thinking: ["Character02_Image01.png", "Character 2 thinking"],
        incorrect: ["Character02_Image08.png", "Character 2 reacting to an incorrect answer"],
        watching: ["Character02_Image09.png", "Character 2 watching another student"],
        watchingOpposite: ["Character02_Image12.png", "Character 2 watching another student on the opposite side"],
      }),
      guessFrames: Object.freeze([
        "Character02_Image02.png",
        "Character02_Image03.png",
        "Character02_Image04.png",
        "Character02_Image05.png",
      ]),
      correctFrames: Object.freeze([
        "Character02_Image06.png",
        "Character02_Image07.png",
      ]),
      sideApplauseFrames: Object.freeze([
        "Character02_Image10.png",
        "Character02_Image11.png",
      ]),
      oppositeApplauseFrames: Object.freeze([
        "Character02_Image13.png",
        "Character02_Image14.png",
      ]),
    }),
  });

  const teacherSpeech = document.getElementById("teacherSpeech");

  function showTeacherSpeech(text = "") {
    if (!teacherSpeech) return;
    teacherSpeech.textContent = text;
    teacherSpeech.classList.toggle("visible", Boolean(text));
  }

  class StudentAnimation {
    constructor(config) {
      this.config = config;
      this.imageElement = document.getElementById(config.imageElementId);
      this.speechElement = document.getElementById(config.speechElementId);
      this.currentState = "idle";
      this.sequenceId = 0;
      this.timer = null;
      this.pendingWait = null;

      config.imageFiles.forEach((filename) => {
        const image = new Image();
        image.src = this.imagePath(filename);
      });

      this.showState("idle");
    }

    imagePath(filename) {
      return `${this.config.imageRoot}/${filename}`;
    }

    cancelSequence() {
      this.sequenceId += 1;
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      const pending = this.pendingWait;
      this.pendingWait = null;
      if (pending) pending(false);
      return this.sequenceId;
    }

    hideSpeech() {
      this.speechElement.textContent = "";
      this.speechElement.classList.remove("visible");
    }

    showImage(filename, stateName, altText, speechText = "") {
      this.currentState = stateName;
      this.imageElement.src = this.imagePath(filename);
      this.imageElement.alt = altText;
      this.imageElement.dataset.state = stateName;
      this.speechElement.textContent = speechText;
      this.speechElement.classList.toggle("visible", Boolean(speechText));
    }

    showState(stateName) {
      const state = this.config.states[stateName];
      if (!state) return;
      this.showImage(state[0], stateName, state[1]);
    }

    wait(duration, sequenceId) {
      return new Promise((resolve) => {
        this.pendingWait = resolve;
        this.timer = setTimeout(() => {
          if (sequenceId !== this.sequenceId) { resolve(false); return; }
          this.timer = null;
          this.pendingWait = null;
          resolve(sequenceId === this.sequenceId);
        }, duration);
      });
    }

    async playFrames(frames, duration, sequenceId, stateName, altText, speechText = "", timing = animationTiming()) {
      const endsAt = performance.now() + duration;
      let frameIndex = 0;
      let displayedFrames = 0;

      while (performance.now() < endsAt || (timing.maxTesting && displayedFrames < frames.length)) {
        this.showImage(frames[frameIndex], stateName, altText, speechText);
        frameIndex = (frameIndex + 1) % frames.length;
        displayedFrames++;
        const remaining = endsAt - performance.now();
        if (!(await this.wait(timing.maxTesting ? timing.frame : Math.min(timing.frame, remaining), sequenceId))) return false;
      }

      return true;
    }

    idle() {
      this.cancelSequence();
      this.showState("idle");
    }

    async think() {
      const sequenceId = this.cancelSequence();
      this.showState("thinking");
      if (await this.wait(animationTiming().thinking, sequenceId)) this.showState("idle");
    }

    async performGuess(guess, location, result = "test", onCorrectTransition = null, displayDuration, timing = animationTiming()) {
      const sequenceId = this.cancelSequence();
      const guessFrames = this.config.guessFrames;
      const speechDuration = Number.isFinite(displayDuration) && displayDuration > 0
        ? displayDuration
        : timing.speaking;

      this.showImage(
        guessFrames[0],
        "handRaised",
        `${this.config.name} raising her hand`
      );
      if (!(await this.wait(timing.handToTeacher, sequenceId))) return;

      showTeacherSpeech("Go ahead.");
      if (!(await this.wait(timing.teacherSpeaking, sequenceId))) return;
      showTeacherSpeech();
      if (!(await this.wait(timing.teacherToStudent, sequenceId))) return;

      this.showImage(
        guessFrames[0],
        "identifyingWord",
        `${this.config.name} identifying a word`,
        location
      );
      if (!(await this.wait(timing.wordLocation, sequenceId))) return;

      for (let index = 1; index < guessFrames.length; index += 1) {
        const speaking = index === guessFrames.length - 1;
        this.showImage(
          guessFrames[index],
          speaking ? "speaking" : "beginningToSpeak",
          speaking
            ? `${this.config.name} speaking`
            : `${this.config.name} beginning to speak`,
          speaking ? guess : ""
        );
        if (!speaking && !(await this.wait(timing.frame, sequenceId))) return;
      }

      if (result === "correct") {
        if (!(await this.wait(timing.correctWatcherDelay, sequenceId))) return;
        if (onCorrectTransition) onCorrectTransition();
        if (!(await this.wait(timing.correctJoinDelay, sequenceId))) return;
        if (!(await this.playFrames(
          this.config.correctFrames,
          timing.correct,
          sequenceId,
          "correct",
          `${this.config.name} applauding after a correct answer`,
          guess, timing
        ))) return;
        const remainingSpeechTime = speechDuration
          - timing.correctWatcherDelay
          - timing.correctJoinDelay
          - timing.correct;
        if (remainingSpeechTime > 0 && !(await this.wait(remainingSpeechTime, sequenceId))) return;
      } else if (result === "incorrect") {
        if (!(await this.wait(speechDuration, sequenceId))) return;
        this.showState("incorrect");
        if (!(await this.wait(timing.incorrect, sequenceId))) return;
      }

      this.showState("idle");
      return true;
    }

    watch(side = "side") {
      this.cancelSequence();
      this.showState(side === "opposite" ? "watchingOpposite" : "watching");
    }

    async applaud(duration, side = "side", timing = animationTiming()) {
      duration = duration ?? timing.correct;
      const sequenceId = this.cancelSequence();
      const opposite = side === "opposite";
      const frames = opposite
        ? this.config.oppositeApplauseFrames
        : this.config.sideApplauseFrames;

      if (!(await this.playFrames(
        frames,
        duration,
        sequenceId,
        "applauding",
        opposite
          ? `${this.config.name} applauding another student on the opposite side`
          : `${this.config.name} applauding another student`,
        "", timing
      ))) return;

      this.showState("idle");
    }
  }

  const students = {};
  Object.entries(STUDENTS).forEach(([id, config]) => {
    if (
      document.getElementById(config.imageElementId) &&
      document.getElementById(config.speechElementId)
    ) {
      students[id] = new StudentAnimation(config);
    }
  });

  function getActor(detail = {}) {
    return students[detail.character] || students.character1;
  }

  function getLookDirection(watcher, speaker) {
    return watcher.config.seat < speaker.config.seat ? "side" : "opposite";
  }

  let groupSequence = 0;

  async function performGroupGuess(characterId, guess, location, result = "test", displayDuration, speedSetting) {
    const owner = ++groupSequence;
    const timing = animationTiming(speedSetting);
    const actor = students[characterId];
    if (!actor) return;

    const watchers = Object.values(students).filter((student) => student !== actor);
    watchers.forEach((watcher) => {
      watcher.watch(getLookDirection(watcher, actor));
    });

    let watcherApplause = [];
    const completed = await actor.performGuess(guess, location, result, () => {
      watcherApplause = watchers.map((watcher) => watcher.applaud(
        timing.correct + timing.correctJoinDelay,
        getLookDirection(watcher, actor), timing
      ));
    }, displayDuration, timing);
    if (!completed || owner !== groupSequence) return;

    if (result === "correct") {
      await Promise.all(watcherApplause);
    } else {
      watchers.forEach((watcher) => watcher.idle());
    }

    if (owner !== groupSequence) return;
    document.dispatchEvent(new CustomEvent("ggg:student-turn-complete", {
      detail: { character: characterId, guess, result },
    }));
  }

  document.addEventListener("ggg:student-thinking", (event) => {
    getActor(event.detail).think();
  });

  document.addEventListener("ggg:student-reset", () => {
    groupSequence++;
    showTeacherSpeech();
    Object.values(students).forEach((student) => student.idle());
  });

  document.addEventListener("ggg:student-watch", (event) => {
    getActor(event.detail).watch(event.detail?.side);
  });

  document.addEventListener("ggg:student-applaud", (event) => {
    const duration = event.detail?.duration;
    getActor(event.detail).applaud(duration === undefined ? undefined
      : globalThis.GGGGameplaySpeed.snapshot().duration(duration, "animationCycle"), event.detail?.side);
  });

  document.addEventListener("ggg:student-guess", (event) => {
    const guess = String(event.detail?.guess || "");
    const location = String(event.detail?.location || "");
    const result = event.detail?.result;
    if (!guess || (result !== "correct" && result !== "incorrect")) return;

    const characterId = students[event.detail?.character]
      ? event.detail.character
      : "character1";
    performGroupGuess(characterId, guess, location, result, event.detail?.displayDuration, event.detail?.speedSetting);
  });

})();
