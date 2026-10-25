/* audio.js — Original preschool cartoon music, sound effects, and
   expressive voice prosody for Milo & Lina Kids. 100% synthesized in
   the browser with WebAudio: no audio samples, no downloaded files, no
   copyrighted melodies, nothing copied from any existing show. Every
   melody below is an original composition for this app.

   VOICES: dialogue is spoken with free device voices (speechSynthesis).
   prosodyFor() shapes each line by character + emotion + punctuation so
   delivery is lively instead of flat. Device speech CANNOT be routed
   into a recording (a browser platform limit), so the exported video
   contains music + sound effects, while spoken voices play live only.
   Baked AI voices (ElevenLabs/Azure/Google) are a future paid/key step.

   The pure parts (themes, mood mapping, SFX picks, prosody, ducking)
   are DOM-free and unit-tested. MusicEngine needs a browser. */
(function (global) {
  'use strict';

  /* ---------- Note helpers (MIDI numbers; C4 = 60) ---------- */
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------- Original themes (melody = 16 eighth-note steps, 0 = rest) ---------- */
  var THEMES = {
    bouncy: {
      name: 'Bouncy Day',
      bpm: 116,
      chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      bass: [48, 43, 45, 41],
      melody: [76, 0, 79, 76, 0, 74, 76, 0, 79, 0, 81, 79, 76, 0, 74, 0],
      melodyInst: 'xylo',
      kick: true, clap: true, shaker: true
    },
    gentle: {
      name: 'Soft & Kind',
      bpm: 84,
      chords: [[53, 57, 60], [57, 60, 64], [53, 57, 60], [48, 52, 55]],
      bass: [41, 45, 41, 36],
      melody: [77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 0, 0],
      melodyInst: 'marimba',
      kick: false, clap: false, shaker: false
    },
    wonder: {
      name: 'Wonder Rise',
      bpm: 100,
      chords: [[60, 64, 67], [64, 67, 71], [65, 69, 72], [55, 59, 62]],
      bass: [48, 52, 53, 43],
      melody: [72, 76, 79, 84, 79, 76, 84, 0, 81, 79, 76, 74, 72, 0, 0, 0],
      melodyInst: 'bell',
      kick: false, clap: false, shaker: true
    },
    fanfare: {
      name: 'Happy Ending',
      bpm: 120,
      chords: [[60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]],
      bass: [48, 41, 43, 48],
      melody: [72, 0, 76, 0, 79, 0, 76, 0, 81, 0, 79, 0, 84, 0, 0, 0],
      melodyInst: 'brass',
      kick: true, clap: true, shaker: false
    }
  };

  function themeForEmotion(emotion) {
    var e = String(emotion || '').toLowerCase();
    if (e.indexOf('worried') >= 0 || e.indexOf('sad') >= 0 || e.indexOf('scared') >= 0) return 'gentle';
    if (e.indexOf('amazed') >= 0 || e.indexOf('surprised') >= 0 || e.indexOf('magic') >= 0) return 'wonder';
    if (e.indexOf('joyful') >= 0 || e.indexOf('proud') >= 0) return 'bouncy';
    if (e.indexOf('curious') >= 0 || e.indexOf('brave') >= 0 || e.indexOf('determined') >= 0) return 'bouncy';
    return 'bouncy';
  }

  /* ---------- Sound-effect picks for a scene (pure) ---------- */
  function sfxForScene(scene, isLast) {
    var text = ((scene.title || '') + ' ' + (scene.event || '')).toLowerCase();
    var out = [];
    var seen = {};
    function add(name, at) {
      if (!seen[name]) { seen[name] = true; out.push({ name: name, at: at }); }
    }
    if (/surprise|amazed|wow|appears|pops/.test(text)) add('sparkle', 0.4);
    if (/magic|glow|shiny|star/.test(text)) add('magic', 0.8);
    if (/found|discover|discovers/.test(text)) add('chime', 0.6);
    if (/funny|laugh|giggle|boing|slip|tickle/.test(text)) add('boing', 0.6);
    if (/walk|follow|search|across|hop|climb|run/.test(text)) add('footsteps', 0.3);
    if (isLast) add('fanfare', 0.5);
    return out;
  }

  /* ---------- Voice prosody (pure) ---------- */
  var VOICE_BASE = {
    milo: { pitch: 1.3, rate: 1.0, volume: 1.0 },
    lina: { pitch: 1.6, rate: 1.0, volume: 1.0 },
    bobo: { pitch: 2.0, rate: 1.25, volume: 1.0 }
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function prosodyFor(speakerId, emotion, line, overrides) {
    var base = VOICE_BASE[speakerId] || { pitch: 1.2, rate: 1.0, volume: 1.0 };
    var pitch = (overrides && overrides.pitch !== undefined) ? overrides.pitch : base.pitch;
    var rate = (overrides && overrides.rate !== undefined) ? overrides.rate : base.rate;
    var e = String(emotion || '').toLowerCase();
    if (e.indexOf('worried') >= 0 || e.indexOf('sad') >= 0) { pitch -= 0.25; rate *= 0.88; }
    else if (e.indexOf('amazed') >= 0 || e.indexOf('surprised') >= 0) { pitch += 0.25; rate *= 1.12; }
    else if (e.indexOf('joyful') >= 0 || e.indexOf('proud') >= 0 || e.indexOf('happy') >= 0) { pitch += 0.15; rate *= 1.05; }
    else if (e.indexOf('curious') >= 0) { pitch += 0.10; }
    else if (e.indexOf('brave') >= 0 || e.indexOf('determined') >= 0) { pitch -= 0.05; rate *= 1.05; }
    var t = String(line || '').trim();
    if (t.charAt(t.length - 1) === '!') { pitch += 0.12; rate *= 1.06; }
    else if (t.charAt(t.length - 1) === '?') { pitch += 0.18; }
    return {
      pitch: clamp(pitch, 0.5, 2.0),
      rate: clamp(rate, 0.7, 1.5),
      volume: base.volume
    };
  }

  function duckTarget(dialogueActive) { return dialogueActive ? 0.35 : 1.0; }

  /* ---------- Browser music engine ---------- */
  function MusicEngine(opts) {
    opts = opts || {};
    this.volume = (opts.volume !== undefined) ? opts.volume : 0.6;
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.voiceBus = null;
    this.dest = null;
    this.analyser = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.theme = 'bouncy';
    this.ducked = false;
    this.noiseBuf = null;
  }

  MusicEngine.prototype.ensureNoise = function () {
    if (this.noiseBuf) return this.noiseBuf;
    var len = this.ctx.sampleRate;
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  };

  MusicEngine.prototype.tone = function (type, freq, t, dur, vol, dest, freqEnd) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest || this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  MusicEngine.prototype.partialTone = function (freq, partials, t, dur, vol, dest) {
    var self = this;
    partials.forEach(function (p) {
      self.tone('sine', freq * p[0], t, dur * p[2], vol * p[1], dest);
    });
  };

  // Ukulele-like pluck: bright triangle + soft 2nd harmonic, quick decay.
  MusicEngine.prototype.pluck = function (freq, t, vol) {
    this.tone('triangle', freq, t, 0.35, vol, this.musicBus);
    this.tone('sine', freq * 2, t, 0.18, vol * 0.3, this.musicBus);
  };

  // Xylophone/marimba: sine + high partial, fast decay.
  MusicEngine.prototype.xylo = function (freq, t, vol, bright) {
    this.tone('sine', freq, t, 0.5, vol, this.musicBus);
    this.tone('sine', freq * (bright ? 4 : 3.9), t, 0.2, vol * 0.18, this.musicBus);
  };

  MusicEngine.prototype.bell = function (freq, t, vol) {
    this.partialTone(freq, [[1, 1, 1], [2.76, 0.4, 0.6], [5.4, 0.2, 0.4]], t, 0.7, vol, this.musicBus);
  };

  MusicEngine.prototype.brass = function (freq, t, vol) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1800;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.45);
  };

  MusicEngine.prototype.noiseHit = function (t, dur, vol, filterType, filterFreq, dest) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.ensureNoise();
    var filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest || this.musicBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  MusicEngine.prototype.kick = function (t, vol) {
    this.tone('sine', 150, t, 0.14, vol, this.musicBus, 50);
  };

  MusicEngine.prototype.clap = function (t, vol) {
    this.noiseHit(t, 0.16, vol, 'bandpass', 1200, this.musicBus);
  };

  MusicEngine.prototype.shaker = function (t, vol) {
    this.noiseHit(t, 0.07, vol, 'highpass', 6000, this.musicBus);
  };

  MusicEngine.prototype.playStep = function (step, t) {
    var theme = THEMES[this.theme];
    var bar = Math.floor(step / 8) % theme.chords.length;
    var chord = theme.chords[bar];
    var inBar = step % 8;
    if (inBar === 0) {
      var self = this;
      chord.forEach(function (m, i) {
        self.pluck(midi(m), t + i * 0.045, 0.16);
      });
      this.tone('sine', midi(theme.bass[bar]), t, 0.45, 0.20, this.musicBus);
    }
    if (inBar === 4) {
      this.tone('sine', midi(theme.bass[bar]), t, 0.4, 0.15, this.musicBus);
    }
    var mel = theme.melody[step % 16];
    if (mel > 0) {
      var f = midi(mel);
      if (theme.melodyInst === 'brass') this.brass(f, t, 0.20);
      else if (theme.melodyInst === 'bell') this.bell(f, t, 0.16);
      else if (theme.melodyInst === 'marimba') this.xylo(f, t, 0.16, false);
      else this.xylo(f, t, 0.17, true);
    }
    if (theme.kick && (step % 4 === 0)) this.kick(t, 0.20);
    if (theme.clap && (step % 8 === 4)) this.clap(t, 0.12);
    if (theme.shaker) this.shaker(t, 0.05);
  };

  MusicEngine.prototype.start = function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      var ctx = new AC();
      this.ctx = ctx;
      if (ctx.resume) ctx.resume();
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.master.connect(this.analyser);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 1.0;
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 1.0;
      this.sfxBus.connect(this.master);
      this.voiceBus = ctx.createGain();
      this.voiceBus.gain.value = 1.0;
      this.voiceBus.connect(this.master);
      if (ctx.createMediaStreamDestination) {
        this.dest = ctx.createMediaStreamDestination();
        this.master.connect(this.dest);
      }
      var self = this;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.1;
      this.timer = setInterval(function () {
        if (!self.ctx) return;
        while (self.nextTime < self.ctx.currentTime + 0.4) {
          self.playStep(self.step, self.nextTime);
          self.step++;
          var bpm = THEMES[self.theme].bpm;
          self.nextTime += 60 / bpm / 2;
        }
      }, 90);
      return true;
    } catch (e) { return false; }
  };

  MusicEngine.prototype.setMood = function (themeId) {
    if (!this.ctx || !THEMES[themeId] || themeId === this.theme) return;
    var t = this.ctx.currentTime;
    var bus = this.musicBus;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0.25, t + 0.2);
    var self = this;
    setTimeout(function () { self.theme = themeId; }, 220);
    bus.gain.linearRampToValueAtTime(1.0, t + 0.8);
  };

  MusicEngine.prototype.setDucking = function (active) {
    if (!this.ctx || active === this.ducked) return;
    this.ducked = active;
    this.musicBus.gain.setTargetAtTime(duckTarget(active), this.ctx.currentTime, 0.12);
  };

  MusicEngine.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    }
  };

  MusicEngine.prototype.getStream = function () {
    return this.dest ? this.dest.stream : null;
  };

  MusicEngine.prototype.playSfx = function (name, delaySec) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime + (delaySec || 0);
    var self = this;
    function bellAt(f, dt, v) { self.bell(f, t + dt, v); }
    if (name === 'sparkle') {
      [88, 91, 95, 98, 100].forEach(function (m, i) { bellAt(midi(m), i * 0.05, 0.14); });
    } else if (name === 'magic') {
      [84, 88, 91, 96, 100].forEach(function (m, i) { bellAt(midi(m), i * 0.07, 0.13); });
      self.bell(midi(100), t + 0.4, 0.08);
    } else if (name === 'chime') {
      bellAt(midi(84), 0, 0.16);
      bellAt(midi(88), 0.14, 0.16);
    } else if (name === 'boing') {
      self.tone('sine', 380, t, 0.32, 0.20, self.sfxBus, 90);
      self.tone('sine', 140, t + 0.14, 0.22, 0.14, self.sfxBus, 300);
    } else if (name === 'footsteps') {
      for (var i = 0; i < 4; i++) {
        self.noiseHit(t + i * 0.24, 0.06, 0.10, 'lowpass', 500, self.sfxBus);
      }
    } else if (name === 'fanfare') {
      [72, 76, 79, 84].forEach(function (m, i) {
        self.brass(midi(m), t + i * 0.15, 0.20);
      });
      self.clap(t + 0.6, 0.12);
    }
  };

  // Play a pre-made voice clip (AudioBuffer) through the mix so it IS
  // captured by the recorder. This is how file-based voice tracks land
  // in exports; device speech (speechSynthesis) cannot be routed here.
  MusicEngine.prototype.playBuffer = function (buffer, delaySec) {
    if (!this.ctx || !buffer) return;
    try {
      var src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.voiceBus || this.master);
      src.start(this.ctx.currentTime + (delaySec || 0));
    } catch (e) { /* ignore */ }
  };

  MusicEngine.prototype.stop = function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ctx) {
      try { this.ctx.close(); } catch (e) { /* ignore */ }
      this.ctx = null;
    }
    this.dest = null;
    this.voiceBus = null;
    this.ducked = false;
  };

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.audio = {
    themes: THEMES,
    themeForEmotion: themeForEmotion,
    sfxForScene: sfxForScene,
    voiceBase: VOICE_BASE,
    prosodyFor: prosodyFor,
    duckTarget: duckTarget,
    MusicEngine: MusicEngine
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
