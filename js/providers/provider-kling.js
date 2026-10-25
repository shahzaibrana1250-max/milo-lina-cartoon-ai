/* providers/provider-kling.js — OPTIONAL video provider (Phase 2).
   Status: coming-soon. Inactive in Phase 1: no network calls, no key.
   HOW TO ACTIVATE LATER: implement generateVideo() with fetch() to the
   Kling API using the user's own key from Settings (browser storage
   only), polling the task until the clip URL returns, then set status
   to 'ready'. Kling clips run 3–15 seconds, which matches this app's
   10–15 second scenes. Until then, use the prompt pack export. */
(function (global) {
  'use strict';

  global.MiloLina.providers.register({
    id: 'kling',
    name: 'Kling (video, optional)',
    kind: 'video',
    status: 'coming-soon',
    needsKey: true,
    generateStory: null,
    generateVideo: function () {
      return Promise.reject(new Error('Kling adapter is not active in Phase 1. Export the prompt pack instead.'));
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
