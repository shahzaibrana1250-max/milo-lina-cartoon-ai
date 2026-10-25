/* prompts.js — Builds the detailed video prompt for one scene.
   Every prompt carries, in order: style lock, character locks (only the
   characters present in that scene), vertical 9:16 format, setting,
   one main event, camera movement, expression, dialogue, sound,
   continuity from the previous scene, and strict no-extra rules. */
(function (global) {
  'use strict';

  function dialogueText(dialogue, nameOf) {
    return dialogue.map(function (d) {
      return nameOf(d.speaker) + ': "' + d.line + '"';
    }).join('\n');
  }

  function buildScenePrompt(project, scene) {
    var chars = global.MiloLina.characters;
    var nameOf = function (id) {
      var c = chars.get(id);
      return c ? c.name : id;
    };
    var lines = [];
    lines.push('STYLE LOCK: ' + chars.STYLE_LOCK);
    lines.push('FORMAT: Vertical video, 9:16 aspect ratio, made for YouTube Shorts.');
    lines.push('CHARACTERS (use exactly as written, never redesign them):');
    lines.push(chars.lockText(scene.characters, project.characterDescs || {}));
    lines.push('');
    lines.push('SCENE ' + scene.n + ' — ' + scene.title + ' (' + scene.duration + ' seconds)');
    lines.push('SETTING: ' + scene.setting + '.');
    lines.push('ACTION (one main event): ' + scene.event + '.');
    lines.push('CAMERA: ' + scene.camera + '.');
    lines.push('EXPRESSION AND EMOTION: The characters look ' + scene.emotion + ', with big clear facial expressions.');
    lines.push('DIALOGUE:');
    lines.push(dialogueText(scene.dialogue, nameOf));
    lines.push('SOUND: ' + scene.sound + '.');
    lines.push('CONTINUITY: ' + scene.opensWith);
    lines.push('RULES: Only the characters listed above appear. No extra people, animals, text, logos, or watermarks. Faces stay bright and clearly visible.');
    return lines.join('\n');
  }

  function buildAllPrompts(project) {
    return project.scenes.map(function (scene) {
      return { sceneId: scene.id, n: scene.n, title: scene.title, prompt: buildScenePrompt(project, scene) };
    });
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.prompts = {
    buildScene: buildScenePrompt,
    buildAll: buildAllPrompts
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
