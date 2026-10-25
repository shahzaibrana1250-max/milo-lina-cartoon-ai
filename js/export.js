/* export.js — One-click exports. Everything is generated on-device.
   - Prompt pack: one Markdown file with every scene prompt, ready to
     paste into any AI video generator.
   - Project JSON: full backup (stories, scenes, character descriptions).
     Import it back any time. Reference images are NOT inside the JSON
     (they are large); re-upload them after an import if needed. */
(function (global) {
  'use strict';

  function buildPromptPack(project) {
    var prompts = global.MiloLina.prompts.buildAll(project);
    var total = global.MiloLina.scenes.totalSeconds(project.scenes);
    var out = [];
    out.push('# ' + project.title);
    out.push('');
    out.push('- Format: Vertical 9:16, YouTube Shorts');
    out.push('- Scenes: ' + project.scenes.length + ' | Total length: ~' + total + ' seconds');
    out.push('- Moral: ' + (project.story ? project.story.moral : ''));
    out.push('- Style: ' + global.MiloLina.characters.STYLE_LOCK);
    out.push('');
    out.push('Paste each scene prompt below into your AI video generator, one scene at a time, in order.');
    out.push('');
    prompts.forEach(function (p) {
      out.push('---');
      out.push('');
      out.push('## Scene ' + p.n + ' — ' + p.title);
      out.push('');
      out.push('```');
      out.push(p.prompt);
      out.push('```');
      out.push('');
    });
    return out.join('\n');
  }

  function buildShortsMeta(project) {
    var total = global.MiloLina.scenes.totalSeconds(project.scenes);
    return [
      'TITLE (Shorts): ' + project.title + ' | Milo & Lina Kids',
      '',
      'DESCRIPTION:',
      project.title + ' — a sweet cartoon adventure with Milo, Lina and Bobo. ' +
        (project.story ? project.story.moral : '') + ' Made for kids and families.',
      '',
      'TAGS: Milo and Lina Kids, kids cartoon, cartoon for kids, funny bunny, ' +
        'children story, youtube shorts, cute cartoon, family friendly',
      '',
      'Length: ~' + total + ' seconds | Format: vertical 9:16'
    ].join('\n');
  }

  // Browser download helper (no-op outside a browser).
  function downloadText(filename, text) {
    if (typeof document === 'undefined') return false;
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return true;
  }

  // Copy helper with a legacy fallback for older Android browsers.
  function copyText(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }
    return new Promise(function (resolve) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve(true);
      } catch (e) { resolve(false); }
    });
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.exporter = {
    promptPack: buildPromptPack,
    shortsMeta: buildShortsMeta,
    download: downloadText,
    copy: copyText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
