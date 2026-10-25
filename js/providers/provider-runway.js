/* providers/provider-runway.js — OPTIONAL video provider (Phase 2).
   Status: coming-soon. Inactive in Phase 1: no network calls, no key.
   HOW TO ACTIVATE LATER: implement generateVideo() with fetch() to the
   Runway API using the user's own key from Settings (browser storage
   only), then set status to 'ready'. Until then, use the prompt pack
   export — it works with Runway's own website today. */
(function (global) {
  'use strict';

  global.MiloLina.providers.register({
    id: 'runway',
    name: 'Runway (video, optional)',
    kind: 'video',
    status: 'coming-soon',
    needsKey: true,
    generateStory: null,
    generateVideo: function () {
      return Promise.reject(new Error('Runway adapter is not active in Phase 1. Export the prompt pack instead.'));
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
