/* scenes.js — Turns a story into connected 10–15 second scenes.
   Continuity rule: every scene after the first opens with the exact
   end-state of the previous scene, so scenes chain without jumps.
   Each scene has ONE main event, an emotion, dialogue, camera and sound. */
(function (global) {
  'use strict';

  var VALID_DURATIONS = [10, 12, 15];

  function sceneCharacters(beatKey) {
    if (beatKey === 'attempt') return ['milo', 'bobo', 'lina'];
    if (beatKey === 'twist') return ['bobo', 'lina', 'milo'];
    return ['milo', 'lina', 'bobo'];
  }

  // durationMode: 10, 12, 15 or 'mixed' (alternates 10/12/15).
  function buildScenes(story, durationMode) {
    var mode = durationMode || 12;
    var scenes = [];
    story.beats.forEach(function (beat, idx) {
      var duration;
      if (mode === 'mixed') duration = VALID_DURATIONS[idx % VALID_DURATIONS.length];
      else duration = VALID_DURATIONS.indexOf(mode) >= 0 ? mode : 12;
      scenes.push({
        id: 'scene-' + (idx + 1),
        n: idx + 1,
        title: beat.title,
        setting: beat.setting,
        event: beat.event,
        emotion: beat.emotion,
        camera: beat.camera,
        sound: beat.sound,
        dialogue: beat.dialogue.map(function (d) { return { speaker: d.speaker, line: d.line }; }),
        characters: sceneCharacters(beat.beat),
        duration: duration,
        opensWith: idx === 0
          ? 'A fresh opening in ' + beat.setting + '.'
          : 'Exactly where the previous scene ended: ' + story.beats[idx - 1].endState,
        endState: beat.endState
      });
    });
    return scenes;
  }

  function totalSeconds(scenes) {
    var t = 0;
    scenes.forEach(function (s) { t += s.duration; });
    return t;
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.scenes = {
    build: buildScenes,
    totalSeconds: totalSeconds,
    validDurations: VALID_DURATIONS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
