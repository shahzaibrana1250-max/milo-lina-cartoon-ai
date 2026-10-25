/* providers/provider-hailuo.js — MiniMax H3 video adapter (Phase 2).
   WHY H3: it is the best verified fit for this app's scenes —
   - 5–15 second generations, exactly the app's scene lengths.
   - Up to 9 reference images (character refs) in one request, so Milo,
     Lina and Bobo can stay consistent across scenes.
   - Native stereo audio (dialogue + sound) generated in the same pass.
   - Reference images may be public URLs OR base64 data URLs, so the
     app's browser-stored reference images can be sent without hosting.
   - Official global API base is https://api.minimax.io (CN: api.minimaxi.com).
   COST (published direct rates, check your dashboard before budgeting):
   - About $0.08/second at 768p, $0.05/second at 480p. A 60-second
     episode (six 10-second scenes) is roughly $5 at 768p.
   - No free tier for the API. A key with prepaid balance is required.
   STATUS: 'needs-key'. This adapter has NOT been live-tested (no key was
   available) and follows the published H3 generations shape:
   POST {baseUrl}/v1/video/generations -> taskId -> poll until completed.
   If your account uses a different host or model id (some resellers
   differ), change Base URL / Model in the Video tab — no code change.
   BROWSER NOTE: some providers do not send CORS headers for browser
   origins. If a call fails with a network error, that is the likely
   cause: use the provider's website with the exported prompt pack, or
   put a tiny free proxy (e.g. Cloudflare Workers free tier) in front.
   Keys stay in browser storage only (see docs/KEYS.md). */
(function (global) {
  'use strict';

  function clampDuration(d) {
    d = Math.round(d || 10);
    if (d < 5) return 5;
    if (d > 15) return 15;
    return d;
  }

  function estimateCost(seconds, ratePerSecond) {
    return (seconds * (ratePerSecond || 0.08)).toFixed(2);
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  var adapter = {
    id: 'hailuo',
    name: 'MiniMax H3 (video, optional)',
    kind: 'video',
    status: 'needs-key',
    needsKey: true,
    estimateCost: estimateCost,
    // args: { prompt, duration, refs, onProgress, settings }
    generateVideo: function (args) {
      args = args || {};
      var settings = args.settings || {};
      var key = settings.keys && settings.keys.hailuo;
      var hailuo = settings.hailuo || {};
      var base = (hailuo.baseUrl || 'https://api.minimax.io').replace(/\/$/, '');
      var model = hailuo.model || 'minimax-h3';
      if (!key) {
        return Promise.reject(new Error('Add your MiniMax API key in the Video tab first. H3 is pay-as-you-go (about $0.08/second at 768p) with no free tier.'));
      }
      var headers = { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
      var body = {
        model: model,
        prompt: args.prompt,
        duration: clampDuration(args.duration),
        resolution: '768p',
        aspect_ratio: '9:16',
        audio_mode: 'native',
        reference_image_urls: args.refs || []
      };
      var progress = args.onProgress || function () {};
      var submit;
      try {
        submit = fetch(base + '/v1/video/generations', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });
      } catch (e) {
        return Promise.reject(new Error('Network call blocked (likely CORS from a browser). Use the exported prompt pack on the provider website, or a small free proxy.'));
      }
      return submit.then(function (res) {
        if (!res.ok) {
          throw new Error('H3 submit failed (HTTP ' + res.status + '). Check your key, base URL and model in the Video tab.');
        }
        return res.json();
      }).then(function (data) {
        var taskId = data && data.data && data.data.taskId;
        if (!taskId) throw new Error('H3 did not return a task id. Check the base URL and model for your account.');
        progress('H3 job ' + taskId + ' submitted — polling…');
        var deadline = Date.now() + 30 * 60 * 1000;
        var poll = function () {
          if (Date.now() > deadline) throw new Error('H3 job timed out after 30 minutes.');
          return fetch(base + '/v1/video/generations?task_id=' + encodeURIComponent(taskId), { headers: headers })
            .then(function (r) {
              if (!r.ok) throw new Error('H3 status check failed (HTTP ' + r.status + ').');
              return r.json();
            })
            .then(function (s) {
              var d = s && s.data;
              if (!d) throw new Error('Unexpected H3 status response.');
              if (d.state === 'completed') {
                var urls = d.resultUrls || (d.result && d.result.urls) || [];
                if (!urls.length) throw new Error('H3 finished but returned no video URL.');
                return { ok: true, videoUrl: urls[0], taskId: taskId };
              }
              if (d.state === 'failed') {
                throw new Error('H3 generation failed: ' + (d.failMsg || 'unknown reason'));
              }
              progress('H3 status: ' + d.state + '…');
              return wait(12000).then(poll);
            });
        };
        return poll();
      }).catch(function (e) {
        if (e && e.name === 'TypeError') {
          throw new Error('Network call blocked (likely CORS from a browser). Use the exported prompt pack on the provider website, or a small free proxy.');
        }
        throw e;
      });
    }
  };

  global.MiloLina.providers.register(adapter);
})(typeof globalThis !== 'undefined' ? globalThis : this);
