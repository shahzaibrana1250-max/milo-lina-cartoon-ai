/* characters.js — Locked character bible for Milo & Lina Kids.
   These descriptions are injected word-for-word into every video prompt
   so characters stay consistent across scenes. The user can edit the
   descriptions in the app; edits are saved in the browser and reused.
   This file has no DOM dependency, so it can be unit-tested in Node. */
(function (global) {
  'use strict';

  var STYLE_LOCK = 'Cute polished 3D cartoon, rounded characters, big expressive eyes, bright cheerful colors, soft daylight, clean simple backgrounds.';

  // Canonical characters. "desc" is the locked text used in prompts.
  var CHARACTERS = [
    {
      id: 'milo',
      name: 'Milo',
      role: 'Hero — cheerful little boy',
      desc: 'Milo, a cheerful little boy wearing a bright yellow raincoat and blue shorts',
      placeholder: 'assets/characters/milo.svg'
    },
    {
      id: 'lina',
      name: 'Lina',
      role: 'Heroine — kind little girl',
      desc: 'Lina, a kind little girl wearing a pink dress, her hair in two pigtails',
      placeholder: 'assets/characters/lina.svg'
    },
    {
      id: 'bobo',
      name: 'Bobo',
      role: 'Friend — small white bunny',
      desc: 'Bobo, a small white bunny wearing an orange scarf',
      placeholder: 'assets/characters/bobo.svg'
    }
  ];

  function getCharacter(id) {
    for (var i = 0; i < CHARACTERS.length; i++) {
      if (CHARACTERS[i].id === id) return CHARACTERS[i];
    }
    return null;
  }

  // Build the character-lock block for the given character ids.
  // overrides: { id: editedDesc } — user edits saved in the browser.
  function characterLockText(ids, overrides) {
    overrides = overrides || {};
    var lines = [];
    ids.forEach(function (id) {
      var c = getCharacter(id);
      if (!c) return;
      lines.push('- ' + c.name + ': ' + (overrides[id] || c.desc) + '.');
    });
    return lines.join('\n');
  }

  function allIds() {
    return CHARACTERS.map(function (c) { return c.id; });
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.characters = {
    STYLE_LOCK: STYLE_LOCK,
    list: CHARACTERS,
    get: getCharacter,
    allIds: allIds,
    lockText: characterLockText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
