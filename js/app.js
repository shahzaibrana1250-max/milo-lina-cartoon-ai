/* app.js — UI wiring for Milo & Lina Kids Cartoon Studio.
   All state lives in the browser (localStorage + IndexedDB). No network
   calls are made in Phase 1. This file only runs in a browser; the core
   logic files (characters/story/scenes/prompts/storage/export) are
   DOM-free and unit-tested separately. */
(function () {
  'use strict';

  if (typeof document === 'undefined') return; // Node/test safety

  var ML = window.MiloLina;
  var state = { projects: [], activeId: null, settings: null };
  var toastTimer = null;
  var videoPlayer = null;

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function getActive() {
    for (var i = 0; i < state.projects.length; i++) {
      if (state.projects[i].id === state.activeId) return state.projects[i];
    }
    return null;
  }
  function saveAll() {
    ML.storage.saveProjects(state.projects);
    ML.storage.saveActiveId(state.activeId);
    ML.storage.saveSettings(state.settings);
  }
  function charDescs() {
    state.settings.charDescs = state.settings.charDescs || {};
    return state.settings.charDescs;
  }
  function projectForPrompts(p) {
    // Prompts always use the current (possibly edited) descriptions.
    var copy = JSON.parse(JSON.stringify(p));
    copy.characterDescs = charDescs();
    return copy;
  }

  function createProject(title, themeId, sceneCount, durationMode) {
    var story = ML.story.build({
      themeId: themeId || '',
      sceneCount: sceneCount,
      seed: (Date.now() % 2147483647) + 1
    });
    var project = {
      id: uid(),
      title: title || story.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      story: story,
      scenes: ML.scenes.build(story, durationMode),
      characterDescs: charDescs()
    };
    state.projects.unshift(project);
    state.activeId = project.id;
    saveAll();
    return project;
  }

  function showPage(page) {
    var pages = document.querySelectorAll('.page');
    pages.forEach(function (s) { s.hidden = (s.id !== 'page-' + page); });
    document.querySelectorAll('.bottomnav button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-page') === page);
    });
    if (videoPlayer) {
      try { videoPlayer.stop(false); } catch (e) { /* ignore */ }
      videoPlayer = null;
    }
    if (page === 'projects') renderProjects();
    if (page === 'characters') renderCharacters();
    if (page === 'story') renderStory();
    if (page === 'scenes') renderScenes();
    if (page === 'prompts') renderPrompts();
    if (page === 'video') renderVideo();
    if (page === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }

  /* ---------------- Projects ---------------- */
  function renderProjects() {
    var box = el('projectList');
    var active = getActive();
    el('activeProjectName').textContent = active ? 'Active: ' + active.title : '';
    if (!state.projects.length) {
      box.innerHTML = '<p class="hint">No projects yet. Create your first one above.</p>';
      return;
    }
    box.innerHTML = state.projects.map(function (p) {
      var total = ML.scenes.totalSeconds(p.scenes);
      return '<div class="card"><h3>' + esc(p.title) + '</h3>' +
        '<p class="meta">' + p.scenes.length + ' scenes · ~' + total + ' seconds · ' +
        esc(p.story ? p.story.themeName : '') + '</p>' +
        '<div class="row">' +
        '<button class="btn small primary" data-open="' + p.id + '">Open</button>' +
        '<button class="btn small" data-dup="' + p.id + '">Duplicate</button>' +
        '<button class="btn small danger" data-del="' + p.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
    box.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () { state.activeId = b.getAttribute('data-open'); saveAll(); renderProjects(); toast('Project opened.'); };
    });
    box.querySelectorAll('[data-dup]').forEach(function (b) {
      b.onclick = function () {
        var src = null;
        state.projects.forEach(function (p) { if (p.id === b.getAttribute('data-dup')) src = p; });
        if (!src) return;
        var copy = JSON.parse(JSON.stringify(src));
        copy.id = uid();
        copy.title = src.title + ' (copy)';
        state.projects.unshift(copy);
        state.activeId = copy.id;
        saveAll(); renderProjects(); toast('Project duplicated.');
      };
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        if (!window.confirm('Delete this project? This cannot be undone.')) return;
        var id = b.getAttribute('data-del');
        state.projects = state.projects.filter(function (p) { return p.id !== id; });
        if (state.activeId === id) state.activeId = state.projects.length ? state.projects[0].id : null;
        saveAll(); renderProjects(); toast('Project deleted.');
      };
    });
  }

  /* ---------------- Characters ---------------- */
  function renderCharacters() {
    var box = el('characterList');
    box.innerHTML = '';
    ML.characters.list.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'card';
      var desc = (charDescs()[c.id] !== undefined) ? charDescs()[c.id] : c.desc;
      card.innerHTML =
        '<h3>' + esc(c.name) + ' — ' + esc(c.role) + '</h3>' +
        '<img class="char-img" alt="' + esc(c.name) + ' reference" src="' + esc(c.placeholder) + '">' +
        '<label>Description (used in every prompt)' +
        '<textarea data-desc="' + c.id + '">' + esc(desc) + '</textarea></label>' +
        '<label>Reference image <input type="file" accept="image/*" data-img="' + c.id + '"></label>' +
        '<button class="btn small" data-rmimg="' + c.id + '">Remove reference image</button>' +
        '<p class="hint">Saved automatically in this browser and reused in every project.</p>';
      box.appendChild(card);
      var img = card.querySelector('img');
      ML.storage.getImage(c.id).then(function (dataUrl) {
        if (dataUrl) img.src = dataUrl;
      });
      card.querySelector('[data-desc]').addEventListener('change', function (e) {
        charDescs()[c.id] = e.target.value;
        var p = getActive();
        if (p) p.characterDescs = charDescs();
        saveAll(); toast(c.name + ' description saved.');
      });
      card.querySelector('[data-img]').addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        downscaleImage(file, 640).then(function (dataUrl) {
          return ML.storage.saveImage(c.id, dataUrl).then(function () { img.src = dataUrl; toast(c.name + ' reference saved.'); });
        }).catch(function () { toast('Could not read that image. Try another file.'); });
      });
      card.querySelector('[data-rmimg]').onclick = function () {
        ML.storage.deleteImage(c.id).then(function () { img.src = c.placeholder; toast(c.name + ' reference removed.'); });
      };
    });
  }

  function downscaleImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          var scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- Story ---------------- */
  function renderStory() {
    var p = getActive();
    var info = el('storyInfo');
    var beats = el('storyBeats');
    if (!p) {
      info.innerHTML = '<p class="hint">No active project. Create one on the Projects tab first.</p>';
      beats.innerHTML = '';
      return;
    }
    var s = p.story;
    info.innerHTML = '<div class="card"><h3>' + esc(p.title) + '</h3>' +
      '<p><strong>Theme:</strong> ' + esc(s.themeName) + '</p>' +
      '<p><strong>Setting:</strong> ' + esc(s.setting) + '</p>' +
      '<p><strong>Moral:</strong> ' + esc(s.moral) + '</p>' +
      '<p class="meta">Props: ' + esc(s.props.join(', ')) + '</p></div>';
    beats.innerHTML = s.beats.map(function (b, i) {
      var lines = b.dialogue.map(function (d) {
        var c = ML.characters.get(d.speaker);
        return '<p>🗨️ <strong>' + esc(c ? c.name : d.speaker) + ':</strong> ' + esc(d.line) + '</p>';
      }).join('');
      return '<div class="card"><h3>Beat ' + (i + 1) + ' — ' + esc(b.title) + '</h3>' +
        '<p>' + esc(b.event) + '.</p>' +
        '<p class="meta">Feeling: ' + esc(b.emotion) + '</p>' + lines + '</div>';
    }).join('');
  }

  /* ---------------- Scenes ---------------- */
  function dialogueToText(dialogue) {
    return dialogue.map(function (d) {
      var c = ML.characters.get(d.speaker);
      return (c ? c.name : d.speaker) + ': ' + d.line;
    }).join('\n');
  }
  function textToDialogue(text) {
    var out = [];
    text.split('\n').forEach(function (line) {
      var m = line.match(/^\s*([^:]+):\s*(.+)\s*$/);
      if (!m) return;
      var name = m[1].trim().toLowerCase();
      var found = null;
      ML.characters.list.forEach(function (c) {
        if (c.name.toLowerCase() === name) found = c.id;
      });
      out.push({ speaker: found || 'milo', line: m[2].trim() });
    });
    return out.length ? out : null;
  }

  function renderScenes() {
    var p = getActive();
    var box = el('sceneList');
    if (!p) {
      box.innerHTML = '<p class="hint">No active project. Create one on the Projects tab first.</p>';
      el('sceneTotal').textContent = '';
      return;
    }
    el('sceneTotal').textContent = p.scenes.length + ' scenes · ~' + ML.scenes.totalSeconds(p.scenes) +
      ' seconds total · vertical 9:16 · each scene opens where the previous one ended.';
    box.innerHTML = '';
    p.scenes.forEach(function (scene, idx) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="scene-head">' +
        '<div class="frame916">Scene ' + scene.n + '<span>' + esc(scene.title) + '<br>' + scene.duration + 's · 9:16</span></div>' +
        '<div class="scene-fields">' +
        '<label>Title <input type="text" data-f="title" value="' + esc(scene.title) + '"></label>' +
        '<label>Main event <textarea data-f="event">' + esc(scene.event) + '</textarea></label>' +
        '<label>Feeling / expression <input type="text" data-f="emotion" value="' + esc(scene.emotion) + '"></label>' +
        '<label>Camera <input type="text" data-f="camera" value="' + esc(scene.camera) + '"></label>' +
        '<label>Sound <input type="text" data-f="sound" value="' + esc(scene.sound) + '"></label>' +
        '<label>Length <select data-f="duration">' +
        [10, 12, 15].map(function (d) {
          return '<option value="' + d + '"' + (d === scene.duration ? ' selected' : '') + '>' + d + ' seconds</option>';
        }).join('') + '</select></label>' +
        '<label>Dialogue (one per line, Name: line) <textarea data-f="dialogue">' + esc(dialogueToText(scene.dialogue)) + '</textarea></label>' +
        '<p class="meta">Continuity: ' + esc(scene.opensWith) + '</p>' +
        '<div class="row">' +
        '<button class="btn small" data-up>↑ Move up</button>' +
        '<button class="btn small" data-down>↓ Move down</button>' +
        '<button class="btn small danger" data-del>Delete</button>' +
        '</div></div></div>';
      box.appendChild(card);
      card.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener('change', function () {
          var f = input.getAttribute('data-f');
          if (f === 'dialogue') {
            var parsed = textToDialogue(input.value);
            if (parsed) scene.dialogue = parsed;
          } else if (f === 'duration') {
            scene.duration = parseInt(input.value, 10);
          } else {
            scene[f] = input.value;
          }
          p.updatedAt = new Date().toISOString();
          saveAll(); renderScenes();
        });
      });
      card.querySelector('[data-up]').onclick = function () {
        if (idx === 0) return;
        swapScenes(p, idx, idx - 1); saveAll(); renderScenes();
      };
      card.querySelector('[data-down]').onclick = function () {
        if (idx === p.scenes.length - 1) return;
        swapScenes(p, idx, idx + 1); saveAll(); renderScenes();
      };
      card.querySelector('[data-del]').onclick = function () {
        if (!window.confirm('Delete this scene?')) return;
        p.scenes.splice(idx, 1);
        renumberScenes(p); saveAll(); renderScenes();
      };
    });
  }

  function swapScenes(p, a, b) {
    var tmp = p.scenes[a];
    p.scenes[a] = p.scenes[b];
    p.scenes[b] = tmp;
    renumberScenes(p);
  }
  function renumberScenes(p) {
    p.scenes.forEach(function (s, i) {
      s.n = i + 1;
      s.id = 'scene-' + (i + 1);
      s.opensWith = i === 0
        ? 'A fresh opening in ' + s.setting + '.'
        : 'Exactly where the previous scene ended: ' + p.scenes[i - 1].endState;
    });
  }

  /* ---------------- Prompts ---------------- */
  function renderPrompts() {
    var p = getActive();
    var box = el('promptList');
    if (!p) {
      box.innerHTML = '<p class="hint">No active project. Create one on the Projects tab first.</p>';
      return;
    }
    var full = projectForPrompts(p);
    var prompts = ML.prompts.buildAll(full);
    box.innerHTML = '';
    prompts.forEach(function (pr) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<h3>Scene ' + pr.n + ' — ' + esc(pr.title) + '</h3>' +
        '<textarea class="prompt-box" readonly>' + esc(pr.prompt) + '</textarea>' +
        '<button class="btn small primary" data-copy>📋 Copy this prompt</button>' +
        '<button class="btn small" data-demo>▶ Demo-generate (free test)</button>' +
        '<p class="meta" data-status></p>';
      box.appendChild(card);
      card.querySelector('[data-copy]').onclick = function () {
        ML.exporter.copy(pr.prompt).then(function (ok) {
          toast(ok ? 'Scene ' + pr.n + ' prompt copied.' : 'Copy failed — long-press the text to copy manually.');
        });
      };
      card.querySelector('[data-demo]').onclick = function () {
        var status = card.querySelector('[data-status]');
        ML.providers.get('demo').generateVideo(pr.prompt, function (step) {
          status.textContent = step;
        }).then(function (r) { status.textContent = r.note; });
      };
    });
  }

  /* ---------------- Video (Phase 2) ---------------- */
  function loadPlayerImages() {
    var jobs = ML.characters.list.map(function (c) {
      return ML.storage.getImage(c.id).then(function (dataUrl) {
        return new Promise(function (resolve) {
          var img = new Image();
          img.onload = function () { resolve([c.id, img]); };
          img.onerror = function () { resolve([c.id, null]); };
          img.src = dataUrl || c.placeholder;
        });
      });
    });
    return Promise.all(jobs).then(function (pairs) {
      var out = {};
      pairs.forEach(function (pr) { if (pr[1]) out[pr[0]] = pr[1]; });
      return out;
    });
  }

  // The last finished recording survives tab switches.
  var lastVideo = null;

  function showReadyVideo() {
    var a = el('btnDownloadVideo');
    var open = el('videoOpenLink');
    if (lastVideo) {
      a.href = lastVideo.url;
      a.download = lastVideo.name;
      a.hidden = false;
      open.href = lastVideo.url;
      open.hidden = false;
    } else {
      a.removeAttribute('href');
      a.hidden = true;
      open.hidden = true;
    }
  }

  function renderVideo() {
    var p = getActive();
    var info = el('videoInfo');
    if (!p) {
      info.textContent = 'No active project. Create one on the Projects tab first.';
      el('btnPlayVideo').onclick = function () {
        el('videoStatus').textContent = 'No active project. Create one on the Projects tab first.';
      };
      el('btnRecordVideo').onclick = el('btnPlayVideo').onclick;
      return;
    }
    var timeline = ML.video.buildTimeline(p.scenes);
    var hailuo = ML.providers.get('hailuo');
    info.textContent = p.scenes.length + ' scenes · ~' + timeline.total + ' seconds · vertical 9:16 · ' +
      'Real-AI estimate (H3 768p, only if you use it): ~$' + hailuo.estimateCost(timeline.total) + '.';
    showReadyVideo();
    // Create the player IMMEDIATELY with placeholders so Record works
    // right away; real character images swap in when they finish loading.
    var placeholders = {};
    ML.characters.list.forEach(function (c) {
      var img = new Image();
      img.src = c.placeholder;
      placeholders[c.id] = img;
    });
    videoPlayer = new ML.video.Player(el('videoCanvas'), {
      images: {},
      placeholders: placeholders,
      voices: (state.settings.voices || {}),
      musicVolume: ((state.settings.musicVolume !== undefined ? state.settings.musicVolume : 60) / 100),
      onStatus: function (m) {
        el('videoStatus').textContent = m;
        if (m.indexOf('failed') >= 0 || m.indexOf('not supported') >= 0 || m.indexOf('Recording stopped') >= 0) {
          el('btnRecordVideo').disabled = false;
        }
      },
      onVideo: function (blob) {
        el('btnRecordVideo').disabled = false;
        if (!blob || !blob.size) {
          el('videoStatus').textContent = 'Recording produced an empty file. Please try recording again.';
          return;
        }
        if (lastVideo) { try { URL.revokeObjectURL(lastVideo.url); } catch (e) { /* ignore */ } }
        lastVideo = {
          url: URL.createObjectURL(blob),
          name: (p.title || 'milo-lina-video').replace(/[^\w\- ]+/g, '') + '.webm'
        };
        showReadyVideo();
        el('videoStatus').textContent = 'Video ready (' + Math.round(blob.size / 1024) + ' KB) — tap Download video.';
        toast('Video recorded — tap Download video.');
      }
    });
    el('videoStatus').textContent = 'Ready. Loading character images…';
    loadPlayerImages().then(function (images) {
      if (videoPlayer) videoPlayer.images = images;
      if (el('videoStatus').textContent.indexOf('Loading character images') === 0) {
        el('videoStatus').textContent = 'Ready — tap Play or Record.';
      }
    });
    el('btnPlayVideo').onclick = function () {
      try {
        videoPlayer.play(ML.video.buildTimeline(p.scenes), false);
      } catch (e) {
        el('videoStatus').textContent = 'Preview failed: ' + (e && e.message ? e.message : 'unknown error');
      }
    };
    el('btnRecordVideo').onclick = function () {
      if (typeof MediaRecorder === 'undefined') {
        el('videoStatus').textContent = 'Recording is not supported in this browser — preview still works.';
        return;
      }
      try {
        el('btnRecordVideo').disabled = true;
        el('videoStatus').textContent = 'Recording starting…';
        videoPlayer.play(ML.video.buildTimeline(p.scenes), true);
        if (!videoPlayer.recording) el('btnRecordVideo').disabled = false;
      } catch (e) {
        el('btnRecordVideo').disabled = false;
        el('videoStatus').textContent = 'Recording failed: ' + (e && e.message ? e.message : 'unknown error');
      }
    };
    el('btnStopVideo').onclick = function () {
      if (videoPlayer) videoPlayer.stop(false);
      el('btnRecordVideo').disabled = false;
      el('videoStatus').textContent = 'Stopped.';
    };
    var mv = el('musicVolume');
    mv.value = (state.settings.musicVolume !== undefined) ? state.settings.musicVolume : 60;
    mv.oninput = function () {
      state.settings.musicVolume = parseInt(mv.value, 10);
      saveAll();
      if (videoPlayer && videoPlayer.music) videoPlayer.music.setVolume(state.settings.musicVolume / 100);
    };
    renderVoiceSettings();
    renderHailuoSettings(p);
  }

  function renderVoiceSettings() {
    var box = el('voiceSettings');
    box.innerHTML = '';
    var available = [];
    try {
      available = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
    } catch (e) { available = []; }
    state.settings.voices = state.settings.voices || {};
    ML.characters.list.forEach(function (c) {
      var cur = state.settings.voices[c.id] || {};
      var def = ML.video.voiceDefaults[c.id] || { pitch: 1.2, rate: 1.0 };
      var row = document.createElement('div');
      row.className = 'voice-row';
      var opts = '<option value="">Auto voice</option>' + available.map(function (v) {
        return '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === cur.voiceURI ? ' selected' : '') + '>' +
          esc(v.name) + ' (' + esc(v.lang) + ')</option>';
      }).join('');
      row.innerHTML = '<strong>' + esc(c.name) + '</strong>' +
        '<label>Voice <select data-v="voice">' + opts + '</select></label>' +
        '<label>Pitch <input type="range" min="0.5" max="2" step="0.1" data-v="pitch" value="' + (cur.pitch !== undefined ? cur.pitch : def.pitch) + '"></label>' +
        '<label>Speed <input type="range" min="0.8" max="1.4" step="0.05" data-v="rate" value="' + (cur.rate !== undefined ? cur.rate : def.rate) + '"></label>' +
        '<button class="btn small" data-test>🔊 Test ' + esc(c.name) + '\'s voice</button>';
      box.appendChild(row);
      row.querySelector('[data-test]').onclick = function () {
        try {
          if (!('speechSynthesis' in window)) { toast('No device voices on this device.'); return; }
          var samples = {
            milo: "Hi! I'm Milo! Let's go on an adventure!",
            lina: "Hi! I'm Lina! This is so much fun!",
            bobo: "Hi! I'm Bobo! Boing, boing, let's hop!"
          };
          var line = samples[c.id] || 'Hello, friends!';
          var v = state.settings.voices[c.id] || {};
          var pros = (ML.audio && ML.audio.prosodyFor)
            ? ML.audio.prosodyFor(c.id, 'joyful', line, v)
            : { pitch: v.pitch || 1.2, rate: v.rate || 1.0 };
          var u = new SpeechSynthesisUtterance(line);
          u.pitch = pros.pitch;
          u.rate = pros.rate;
          if (v.voiceURI) {
            var all = window.speechSynthesis.getVoices();
            for (var i = 0; i < all.length; i++) {
              if (all[i].voiceURI === v.voiceURI) { u.voice = all[i]; break; }
            }
          }
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        } catch (e) { toast('Voice test failed on this device.'); }
      };
      row.querySelectorAll('[data-v]').forEach(function (input) {
        input.addEventListener('change', function () {
          var v = state.settings.voices[c.id] || {};
          var kind = input.getAttribute('data-v');
          if (kind === 'voice') v.voiceURI = input.value;
          if (kind === 'pitch') v.pitch = parseFloat(input.value);
          if (kind === 'rate') v.rate = parseFloat(input.value);
          state.settings.voices[c.id] = v;
          if (videoPlayer) videoPlayer.voices = state.settings.voices;
          saveAll();
        });
      });
    });
    if (!available.length) {
      var note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'No device voices detected yet — reopen this tab in a moment and they usually appear.';
      box.appendChild(note);
    }
  }

  function renderHailuoSettings(p) {
    state.settings.hailuo = state.settings.hailuo || {};
    state.settings.keys = state.settings.keys || {};
    var baseInput = el('hailuoBase');
    var modelInput = el('hailuoModel');
    var keyInput = el('hailuoKey');
    baseInput.value = state.settings.hailuo.baseUrl || 'https://api.minimax.io';
    modelInput.value = state.settings.hailuo.model || 'minimax-h3';
    keyInput.value = state.settings.keys.hailuo || '';
    baseInput.onchange = function () { state.settings.hailuo.baseUrl = baseInput.value.trim(); saveAll(); };
    modelInput.onchange = function () { state.settings.hailuo.model = modelInput.value.trim(); saveAll(); };
    keyInput.onchange = function () { state.settings.keys.hailuo = keyInput.value; saveAll(); toast('H3 key saved in this browser only.'); };
    el('hailuoNote').textContent = state.settings.keys.hailuo
      ? 'Key saved. Scene 1 test below will spend real money (about $0.80 for a 10-second 768p clip).'
      : 'No key yet — the test button will ask you to add one first. Nothing is charged until then.';
    el('btnHailuoScene').onclick = function () {
      var adapter = ML.providers.get('hailuo');
      var scene = p.scenes[0];
      if (!scene) { toast('This project has no scenes.'); return; }
      var prompt = ML.prompts.buildScene(projectForPrompts(p), scene);
      var note = el('hailuoNote');
      note.textContent = 'Collecting reference images…';
      var refJobs = scene.characters.map(function (id) { return ML.storage.getImage(id); });
      Promise.all(refJobs).then(function (urls) {
        var refs = urls.filter(function (u) { return !!u; });
        note.textContent = 'Sending Scene 1 to H3… (this takes minutes)';
        return adapter.generateVideo({
          prompt: prompt,
          duration: scene.duration,
          refs: refs,
          settings: state.settings,
          onProgress: function (m) { note.textContent = m; }
        });
      }).then(function (r) {
        note.textContent = 'Done! Video ready:';
        el('hailuoResult').innerHTML =
          '<video controls src="' + esc(r.videoUrl) + '"></video>' +
          '<p><a href="' + esc(r.videoUrl) + '" target="_blank" rel="noopener">Open / download Scene 1 video</a></p>';
        toast('Scene 1 generated with H3.');
      }).catch(function (e) {
        note.textContent = 'H3 test failed: ' + (e && e.message ? e.message : e);
      });
    };
  }

  /* ---------------- Settings ---------------- */
  function renderSettings() {
    var sel = el('providerSelect');
    sel.innerHTML = ML.providers.list().map(function (pr) {
      return '<option value="' + pr.id + '"' + (pr.id === state.settings.provider ? ' selected' : '') + '>' +
        esc(pr.name) + (pr.status === 'coming-soon' ? ' — coming soon' : '') + '</option>';
    }).join('');
    var current = ML.providers.get(state.settings.provider);
    el('providerNote').textContent = current.status === 'ready'
      ? current.name + ' is active. Demo mode costs nothing and sends nothing anywhere.'
      : (current.status === 'needs-key'
        ? current.name + ' is ready to test once you add your own key in the Video tab. Nothing is sent until you press Generate.'
        : current.name + ' is not active yet. It needs its own adapter and your own key later. Nothing is sent anywhere right now.');
    var keys = el('keyFields');
    keys.innerHTML = '';
    ML.providers.list().filter(function (pr) { return pr.needsKey; }).forEach(function (pr) {
      var label = document.createElement('label');
      label.textContent = pr.name + ' API key (optional, Phase 2 only)';
      var input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'Stored only in this browser';
      input.value = (state.settings.keys && state.settings.keys[pr.id]) || '';
      input.addEventListener('change', function () {
        state.settings.keys = state.settings.keys || {};
        state.settings.keys[pr.id] = input.value;
        saveAll(); toast('Key saved in this browser only.');
      });
      label.appendChild(input);
      keys.appendChild(label);
    });
    el('storageNote').textContent =
      'Projects and settings are saved in this browser (localStorage); reference images use IndexedDB. ' +
      'Limits: data stays on THIS device and THIS browser only — it does not sync. ' +
      'Clearing site data, uninstalling the browser, or using private/incognito mode can erase it. ' +
      'Export your project JSON and prompt pack regularly as backup. ' +
      'Storage available here: ' + (ML.storage.hasLocalStorage() ? 'yes' : 'no — saving will not work in this browser');
  }

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    state.projects = ML.storage.loadProjects();
    state.activeId = ML.storage.loadActiveId();
    state.settings = ML.storage.loadSettings();
    state.settings.keys = state.settings.keys || {};
    state.settings.charDescs = state.settings.charDescs || {};

    // Theme options
    var themeSel = el('newTheme');
    ML.story.themes.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.name;
      themeSel.appendChild(o);
    });

    // First run: a sample project so every screen works immediately.
    if (!state.projects.length) {
      var story = ML.story.build({ themeId: 'rain', sceneCount: 5, seed: 20261025 });
      var sample = {
        id: uid(),
        title: 'Milo and the Rainy Day Picnic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        story: story,
        scenes: ML.scenes.build(story, 12),
        characterDescs: {}
      };
      state.projects.push(sample);
      state.activeId = sample.id;
      saveAll();
    } else if (!getActive()) {
      state.activeId = state.projects[0].id;
      saveAll();
    }

    document.querySelectorAll('.bottomnav button').forEach(function (b) {
      b.addEventListener('click', function () { showPage(b.getAttribute('data-page')); });
    });

    el('btnCreate').onclick = function () {
      var title = el('newTitle').value.trim();
      var themeId = el('newTheme').value;
      var count = parseInt(el('newScenes').value, 10);
      var dur = el('newDuration').value;
      var durationMode = (dur === 'mixed') ? 'mixed' : parseInt(dur, 10);
      createProject(title, themeId, count, durationMode);
      el('newTitle').value = '';
      renderProjects();
      showPage('story');
      toast('Project created.');
    };

    el('btnImport').onclick = function () { el('importFile').click(); };
    el('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.scenes)) throw new Error('bad file');
          data.id = uid();
          data.title = (data.title || 'Imported project') + ' (imported)';
          state.projects.unshift(data);
          state.activeId = data.id;
          saveAll(); renderProjects(); showPage('story');
          toast('Project imported.');
        } catch (err) { toast('That file is not a valid project export.'); }
      };
      reader.readAsText(file);
    });

    el('btnGenerate').onclick = function () {
      var p = getActive();
      if (!p) { toast('Create a project first.'); return; }
      var count = p.scenes.length;
      p.story = ML.story.build({ themeId: p.story.themeId, sceneCount: count, seed: (Date.now() % 2147483647) + 1 });
      p.scenes = ML.scenes.build(p.story, 12);
      p.title = p.story.title;
      p.updatedAt = new Date().toISOString();
      saveAll(); renderStory(); toast('New story generated.');
    };
    el('btnToScenes').onclick = function () { showPage('scenes'); };

    el('btnAddScene').onclick = function () {
      var p = getActive();
      if (!p) return;
      var last = p.scenes[p.scenes.length - 1];
      var scene = {
        id: 'scene-' + (p.scenes.length + 1),
        n: p.scenes.length + 1,
        title: 'New Scene',
        setting: last ? last.setting : (p.story ? p.story.setting : ''),
        event: 'Milo, Lina and Bobo discover something new together',
        emotion: 'curious and happy',
        camera: 'Medium shot, gentle push-in',
        sound: 'cheerful music, happy birdsong',
        dialogue: [{ speaker: 'milo', line: 'Look, friends! Something new!' }],
        characters: ['milo', 'lina', 'bobo'],
        duration: 12,
        opensWith: last ? 'Exactly where the previous scene ended: ' + last.endState : '',
        endState: 'Milo, Lina and Bobo discover something new together.'
      };
      p.scenes.push(scene);
      saveAll(); renderScenes(); toast('Scene added — edit it above.');
    };

    el('btnCopyAll').onclick = function () {
      var p = getActive();
      if (!p) return;
      ML.exporter.copy(ML.exporter.promptPack(projectForPrompts(p))).then(function (ok) {
        toast(ok ? 'All prompts copied — paste into your video generator.' : 'Copy failed — use Download instead.');
      });
    };
    el('btnDownloadPack').onclick = function () {
      var p = getActive();
      if (!p) return;
      ML.exporter.download('Milo-Lina-Prompts.md', ML.exporter.promptPack(projectForPrompts(p)));
      toast('Prompt pack downloaded.');
    };
    el('btnDownloadMeta').onclick = function () {
      var p = getActive();
      if (!p) return;
      ML.exporter.download('Milo-Lina-Shorts-Info.txt', ML.exporter.shortsMeta(projectForPrompts(p)));
      toast('Shorts info downloaded.');
    };
    el('btnDownloadJson').onclick = function () {
      var p = getActive();
      if (!p) return;
      ML.exporter.download('Milo-Lina-Project.json', JSON.stringify(p, null, 2));
      toast('Project backup downloaded.');
    };

    el('providerSelect').addEventListener('change', function (e) {
      state.settings.provider = e.target.value;
      saveAll(); renderSettings();
    });
    el('btnClearData').onclick = function () {
      if (!window.confirm('Delete ALL projects, settings and keys in this browser? Export a backup first!')) return;
      ML.storage.clearAll();
      window.location.reload();
    };

    showPage('projects');
  });
})();
