/* video.js — Phase 2 in-browser video studio (FREE, no key, no account).
   What it does: turns a project into a REAL playable, exportable video:
   each scene animates its character reference image with slow Ken Burns
   motion, shows the scene title and dialogue as subtitles, speaks the
   dialogue with free device voices, and plays cheerful background music.
   Export uses canvas capture + MediaRecorder to produce a .webm file.

   HONEST LIMITS (also shown in the app's Video tab):
   - This is an animatic: motion comes from camera moves over still
     character art, not from an AI video model. True AI motion needs a
     paid provider (see js/providers/provider-hailuo.js).
   - Spoken dialogue (device voices) plays during live preview but is
     NOT baked into the exported file: browsers do not let a page route
     speech-synthesis audio into a recording. The export has music +
     burned-in subtitles. For baked AI voices, use a voice provider
     (ElevenLabs Starter or later) in Phase 2.
   - Export format is .webm (VP8/VP9 where supported). Convert to .mp4
     with any free converter before uploading to Shorts if needed.

   The pure functions (timeline, scene lookup, subtitles, fades) are
   DOM-free and unit-tested. The Player class needs a browser. */
(function (global) {
  'use strict';

  /* ---------- Pure timeline logic (testable) ---------- */

  function buildTimeline(scenes) {
    var out = [];
    var t = 0;
    scenes.forEach(function (s) {
      out.push({ scene: s, start: t, end: t + s.duration });
      t += s.duration;
    });
    return { items: out, total: t };
  }

  function sceneAt(timeline, t) {
    var items = timeline.items;
    if (!items.length) return null;
    if (t <= 0) return { index: 0, scene: items[0].scene, local: 0, progress: 0 };
    if (t >= timeline.total) {
      var last = items[items.length - 1];
      return { index: items.length - 1, scene: last.scene, local: last.scene.duration, progress: 1 };
    }
    for (var i = 0; i < items.length; i++) {
      if (t >= items[i].start && t < items[i].end) {
        return { index: i, scene: items[i].scene, local: t - items[i].start, progress: (t - items[i].start) / items[i].scene.duration };
      }
    }
    return null;
  }

  // Which dialogue line is active at local time t within a scene?
  // Lines split the scene duration equally.
  function subtitleAt(scene, localT) {
    var lines = scene.dialogue || [];
    if (!lines.length) return null;
    var slice = scene.duration / lines.length;
    var idx = Math.floor(localT / slice);
    if (idx >= lines.length) idx = lines.length - 1;
    return { index: idx, speaker: lines[idx].speaker, line: lines[idx].line };
  }

  // Fade factor: 0 at the very start/end, 1 in the middle (0.5s ramps).
  function fadeAlpha(localT, duration) {
    var ramp = 0.5;
    if (localT < ramp) return localT / ramp;
    if (localT > duration - ramp) return Math.max(0, (duration - localT) / ramp);
    return 1;
  }

  var MUSIC_NOTES = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 587.33, 783.99];
  var BG_PALETTES = [
    ['#ffe9a8', '#ffb3a3'], ['#c8f7dc', '#8fd6ff'],
    ['#ffe3f1', '#c9b6ff'], ['#fff3bf', '#9be7ff'],
    ['#d8f3dc', '#ffe08a'], ['#e0fbfc', '#ffc8dd']
  ];

  // Voice defaults come from the audio engine when available.
  var VOICE_DEFAULTS = (global.MiloLina.audio && global.MiloLina.audio.voiceBase) || {
    milo: { pitch: 1.3, rate: 1.0 },
    lina: { pitch: 1.6, rate: 1.0 },
    bobo: { pitch: 2.0, rate: 1.25 }
  };

  /* ---------- Browser player (canvas + audio + speech) ---------- */

  function wrapText(ctx, text, maxWidth) {
    var words = String(text).split(' ');
    var lines = [];
    var cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawCover(ctx, img, x, y, w, h) {
    var scale = Math.max(w / img.width, h / img.height);
    var dw = img.width * scale;
    var dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function Player(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = opts.images || {}; // { charId: HTMLImageElement }
    this.placeholders = opts.placeholders || {};
    this.voices = opts.voices || {}; // { charId: {voiceURI, pitch, rate} }
    this.onStatus = opts.onStatus || function () {};
    this.onVideo = opts.onVideo || function () {};
    this.playing = false;
    this.recording = false;
    this.raf = 0;
    this.music = null;
    this.musicVolume = (opts.musicVolume !== undefined) ? opts.musicVolume : 0.6;
    this.recorder = null;
    this.chunks = [];
    this.lastSpoken = '';
    this.lastMoodKey = '';
    this.lastSfxKey = '';
  }

  Player.prototype.imageFor = function (id) {
    return this.images[id] || this.placeholders[id] || null;
  };

  // Music + SFX engine (js/audio.js). Started once per playback; its
  // stream is what the recorder captures, so exports contain music+SFX.
  Player.prototype.startAudio = function () {
    try {
      var A = global.MiloLina.audio;
      if (!A) return;
      var engine = new A.MusicEngine({ volume: this.musicVolume });
      if (engine.start()) {
        this.music = engine;
        this.lastMoodKey = '';
        this.lastSfxKey = '';
      }
    } catch (e) { /* audio is best-effort */ }
  };

  Player.prototype.stopAudio = function () {
    if (this.music) {
      try { this.music.stop(); } catch (e) { /* ignore */ }
      this.music = null;
    }
    this.lastMoodKey = '';
    this.lastSfxKey = '';
  };

  // Expressive device-voice delivery: character base + scene emotion +
  // punctuation shape the pitch and speed of every line.
  Player.prototype.speak = function (speakerId, line, emotion) {
    try {
      if (!('speechSynthesis' in window)) return;
      var A = global.MiloLina.audio;
      var v = this.voices[speakerId] || {};
      var pros = A ? A.prosodyFor(speakerId, emotion, line, v) : null;
      var def = VOICE_DEFAULTS[speakerId] || { pitch: 1.2, rate: 1.0 };
      var u = new SpeechSynthesisUtterance(line);
      u.pitch = pros ? pros.pitch : (v.pitch !== undefined ? v.pitch : def.pitch);
      u.rate = pros ? pros.rate : (v.rate !== undefined ? v.rate : def.rate);
      if (v.voiceURI) {
        var all = window.speechSynthesis.getVoices();
        for (var i = 0; i < all.length; i++) {
          if (all[i].voiceURI === v.voiceURI) { u.voice = all[i]; break; }
        }
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is best-effort */ }
  };

  Player.prototype.draw = function (timeline, t) {
    var ctx = this.ctx;
    var W = this.canvas.width;
    var H = this.canvas.height;
    var pos = sceneAt(timeline, t);
    if (!pos) return;
    var scene = pos.scene;
    var pal = BG_PALETTES[pos.index % BG_PALETTES.length];
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Ken Burns: slow zoom + drift over the scene.
    var zoom = 1.0 + 0.14 * pos.progress;
    var drift = (pos.progress - 0.5) * 30;
    var img = scene.characters && scene.characters.length ? this.imageFor(scene.characters[0]) : null;
    ctx.save();
    ctx.globalAlpha = fadeAlpha(pos.local, scene.duration);
    if (img) {
      var iw = W * 0.86 * zoom;
      var ih = iw;
      var ix = (W - iw) / 2 + drift;
      var iy = H * 0.16;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, iy + ih / 2, Math.min(iw, ih) / 2, 0, Math.PI * 2);
      ctx.clip();
      drawCover(ctx, img, ix, iy, iw, ih);
      ctx.restore();
      // Second character peeking in the corner, when present.
      if (scene.characters.length > 1) {
        var img2 = this.imageFor(scene.characters[1]);
        if (img2) {
          var s2 = W * 0.34;
          ctx.save();
          ctx.beginPath();
          ctx.arc(W * 0.82, H * 0.72, s2 / 2, 0, Math.PI * 2);
          ctx.clip();
          drawCover(ctx, img2, W * 0.82 - s2 / 2, H * 0.72 - s2 / 2, s2, s2);
          ctx.restore();
        }
      }
    }
    // Title bar
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scene ' + scene.n + ' — ' + scene.title, W / 2, 56);
    // Subtitle bar
    var sub = subtitleAt(scene, pos.local);
    if (sub) {
      var chars = global.MiloLina.characters;
      var c = chars.get(sub.speaker);
      var label = (c ? c.name : sub.speaker) + ': ' + sub.line;
      ctx.font = 'bold 30px system-ui, sans-serif';
      var lines = wrapText(ctx, label, W - 80);
      var boxH = lines.length * 40 + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(24, H - boxH - 64, W - 48, boxH);
      ctx.fillStyle = '#fff';
      lines.forEach(function (ln, i) {
        ctx.fillText(ln, W / 2, H - boxH - 64 + 40 + i * 40);
      });
    }
    // Progress bar
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, H - 16, W, 16);
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(0, H - 16, W * (t / timeline.total), 16);
    ctx.restore();

    // Music follows the scene: mood theme, ducking under dialogue,
    // and one-shot sound effects once per scene.
    if (this.music && global.MiloLina.audio) {
      var A = global.MiloLina.audio;
      var isLast = pos.index === timeline.items.length - 1;
      var theme = isLast ? 'fanfare' : A.themeForEmotion(scene.emotion);
      if (theme !== this.lastMoodKey) {
        this.lastMoodKey = theme;
        this.music.setMood(theme);
      }
      this.music.setDucking(!!sub);
      if (scene.id !== this.lastSfxKey) {
        this.lastSfxKey = scene.id;
        var eng = this.music;
        A.sfxForScene(scene, isLast).forEach(function (ev) {
          eng.playSfx(ev.name, ev.at);
        });
      }
    }
    // Speak each subtitle line once when it starts (preview only).
    if (sub && !this.recording) {
      var key = scene.id + ':' + sub.index;
      if (key !== this.lastSpoken) {
        this.lastSpoken = key;
        this.speak(sub.speaker, sub.line, scene.emotion);
      }
    }
  };

  Player.prototype.play = function (timeline, record) {
    var self = this;
    this.stop();
    this.playing = true;
    this.recording = !!record;
    this.lastSpoken = '';
    this.chunks = [];
    var stream = null;
    if (record && this.canvas.captureStream) {
      this.startAudio();
      var tracks = [];
      try { tracks = tracks.concat(this.canvas.captureStream(30).getVideoTracks()); } catch (e) { /* ignore */ }
      var astream = this.music ? this.music.getStream() : null;
      if (astream) tracks = tracks.concat(astream.getAudioTracks());
      if (tracks.length) {
        stream = new MediaStream(tracks);
        var mime = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mime = 'video/webm;codecs=vp9';
          else if (MediaRecorder.isTypeSupported('video/webm')) mime = 'video/webm';
        }
        try {
          this.recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          this.recorder.ondataavailable = function (e) {
            if (e.data && e.data.size) self.chunks.push(e.data);
          };
          this.recorder.onstop = function () {
            var blob = new Blob(self.chunks, { type: self.recorder.mimeType || 'video/webm' });
            self.onVideo(blob);
          };
          this.recorder.start(1000);
        } catch (e) {
          this.onStatus('Recording is not supported in this browser. Preview still works.');
          this.recording = false;
        }
      }
    } else {
      this.startAudio();
    }
    var t0 = performance.now();
    var loop = function (now) {
      if (!self.playing) return;
      var t = (now - t0) / 1000;
      if (t >= timeline.total) {
        self.draw(timeline, timeline.total);
        self.stop(true);
        return;
      }
      self.draw(timeline, t);
      self.raf = requestAnimationFrame(loop);
    };
    this.onStatus(record ? 'Recording… please wait until it finishes.' : 'Playing preview…');
    this.raf = requestAnimationFrame(loop);
  };

  // finished=true when playback reached the end naturally.
  Player.prototype.stop = function (finished) {
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    this.stopAudio();
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch (e) { /* ignore */ }
    }
    if (finished && this.recording) this.onStatus('Video ready below — tap Download video.');
    else if (finished) this.onStatus('Preview finished.');
    this.recording = false;
  };

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.video = {
    buildTimeline: buildTimeline,
    sceneAt: sceneAt,
    subtitleAt: subtitleAt,
    fadeAlpha: fadeAlpha,
    musicNotes: MUSIC_NOTES,
    voiceDefaults: VOICE_DEFAULTS,
    Player: Player
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
