/* providers/provider-gemini.js — OPTIONAL text provider (Phase 2).
   Status: coming-soon. The adapter is intentionally inactive in Phase 1:
   it makes no network calls and needs no key.
   HOW TO ACTIVATE LATER (one file, no app rewrite):
   1. User pastes their own Gemini API key in Settings (stored only in
      their browser's localStorage, never in the repo).
   2. Implement generateStory() with fetch() to the Gemini endpoint,
      asking for a story in the app's beat JSON shape.
   3. Set status to 'ready'. The Story page already calls this interface.
   Until then, the built-in generator in js/story.js covers story needs. */
(function (global) {
  'use strict';

  global.MiloLina.providers.register({
    id: 'gemini',
    name: 'Gemini (text, optional)',
    kind: 'text',
    status: 'coming-soon',
    needsKey: true,
    generateStory: function () {
      return Promise.reject(new Error('Gemini adapter is not active in Phase 1. Use the built-in story generator.'));
    },
    generateVideo: null
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
