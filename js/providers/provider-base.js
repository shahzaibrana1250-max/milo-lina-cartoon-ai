/* providers/provider-base.js — The shared provider interface.
   Every provider (demo, Gemini, Kling, Runway, or a future one) must
   implement the same shape, so adding a real provider later means
   writing ONE adapter file and registering it here — no app rewrite.
   Phase 1 rule: no provider sends anything anywhere without a key the
   user typed themselves, and keys are never written into the repo. */
(function (global) {
  'use strict';

  // Interface (documentation contract):
  // {
  //   id, name, kind: 'text' | 'video',
  //   status: 'ready' | 'coming-soon',
  //   needsKey: boolean,
  //   generateStory: function(project) -> Promise<story> | null,
  //   generateVideo: function(scenePrompt) -> Promise<result> | null
  // }
  var registry = {};

  function register(provider) {
    registry[provider.id] = provider;
  }

  function get(id) { return registry[id] || registry.demo; }
  function list() {
    return Object.keys(registry).map(function (k) { return registry[k]; });
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.providers = {
    register: register,
    get: get,
    list: list
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
