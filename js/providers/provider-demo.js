/* providers/provider-demo.js — Free simulated provider (Phase 1 default).
   It pretends to generate, step by step, so every screen can be tested
   end to end with no key and no cost. It produces no real video; the
   real output of Phase 1 is the prompt pack you paste into a generator. */
(function (global) {
  'use strict';

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  var demo = {
    id: 'demo',
    name: 'Demo (free, built-in)',
    kind: 'video',
    status: 'ready',
    needsKey: false,
    generateStory: function () { return Promise.resolve(null); },
    generateVideo: function (scenePrompt, onProgress) {
      var steps = ['Reading prompt…', 'Locking characters…', 'Rendering scene…', 'Demo complete — no real video (Phase 1).'];
      var chain = Promise.resolve();
      steps.forEach(function (step, i) {
        chain = chain.then(function () {
          if (onProgress) onProgress(step);
          return wait(400);
        });
      });
      return chain.then(function () {
        return {
          ok: true,
          demo: true,
          note: 'Demo mode: this is a simulation. Paste the scene prompt into your AI video generator to render real video.'
        };
      });
    }
  };

  global.MiloLina.providers.register(demo);
})(typeof globalThis !== 'undefined' ? globalThis : this);
