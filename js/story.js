/* story.js — Built-in original story generator. No API, no key, no cost.
   Stories follow a fixed emotional arc so scenes stay connected:
   hook -> problem -> brave attempt -> surprise twist -> happy ending.
   Variation comes from theme, lost object, weather detail and moral,
   picked with a seeded random generator so every "Generate" differs.
   Dialogue is simple international English, safe for young children. */
(function (global) {
  'use strict';

  // Seeded RNG (mulberry32) — deterministic per seed, varied per story.
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  var THEMES = [
    {
      id: 'rain',
      name: 'Rainy Day Adventure',
      setting: 'a sunny garden path after a gentle rain, puddles sparkling',
      hook: 'a rainbow appears over the garden after the rain',
      problem: 'the wind blows their picnic basket into a big puddle',
      attempt: 'they build a little bridge out of flat stones',
      twist: 'Bobo hops across the stones and saves the basket with his scarf',
      ending: 'they share sandwiches on a dry blanket under the rainbow',
      props: ['picnic basket', 'flat stones', 'checkered blanket'],
      sounds: 'gentle birdsong, soft splashing, happy ukulele music'
    },
    {
      id: 'garden',
      name: 'Garden Mystery',
      setting: 'a bright flower garden with a tall sunflower in the middle',
      hook: 'a tiny glowing seed is found under the sunflower',
      problem: 'the seed rolls away and hides under a big leaf',
      attempt: 'they follow a trail of petals to find it',
      twist: 'the seed pops open and a little butterfly says thank you',
      ending: 'they plant the seed together and water it with a blue can',
      props: ['glowing seed', 'watering can', 'flower petals'],
      sounds: 'buzzing bees, rustling leaves, cheerful flute music'
    },
    {
      id: 'beach',
      name: 'Beach Day',
      setting: 'a sandy beach with gentle waves and colorful shells',
      hook: 'a shiny seashell sings a tiny song when the waves touch it',
      problem: 'a wave carries the shell back into the sea',
      attempt: 'they build a sand wall to keep the waves back',
      twist: 'Bobo digs a little channel and the shell floats right back',
      ending: 'they listen to the shell song together at sunset',
      props: ['shiny seashell', 'sand bucket', 'striped beach towel'],
      sounds: 'soft waves, seagulls, light happy music'
    },
    {
      id: 'snow',
      name: 'Snowy Morning',
      setting: 'a snowy garden with soft white hills and a frozen pond',
      hook: 'fresh snow covers everything like a white blanket',
      problem: 'their snowman loses his carrot nose in the wind',
      attempt: 'they search behind every snowy bush',
      twist: 'Bobo finds the carrot under a snowdrift and wears it proudly',
      ending: 'they finish the snowman and drink warm cocoa together',
      props: ['carrot nose', 'red scarf', 'warm cocoa mugs'],
      sounds: 'crunching snow, soft wind, cozy bells music'
    },
    {
      id: 'market',
      name: 'Little Market',
      setting: 'a colorful morning market with fruit stalls and balloons',
      hook: 'the market is full of red apples and yellow balloons',
      problem: 'a balloon floats away with their shopping list tied to it',
      attempt: 'they follow the balloon through the market stalls',
      twist: 'the balloon lands softly on a kind baker\'s cart',
      ending: 'the baker shares warm buns and they finish shopping together',
      props: ['red balloon', 'shopping list', 'warm buns'],
      sounds: 'market chatter, happy street music, balloon squeaks'
    },
    {
      id: 'stars',
      name: 'Starry Night',
      setting: 'a quiet hill under a deep blue starry sky',
      hook: 'a little star falls softly onto the hill',
      problem: 'the little star is too tired to fly back up',
      attempt: 'they make a soft nest of leaves and sing it a lullaby',
      twist: 'the star glows bright and lifts them gently for one happy spin',
      ending: 'the star flies home, twinkling goodbye, and they wave',
      props: ['little star', 'leaf nest', 'paper lantern'],
      sounds: 'crickets, soft lullaby music, gentle night wind'
    }
  ];

  var MORALS = [
    'Sharing makes everything better.',
    'Patience and teamwork can solve any problem.',
    'Kindness always comes back to you.',
    'Being brave means trying, even when you feel scared.',
    'Good friends help each other, no matter what.'
  ];

  var LOST_OBJECTS = ['red kite', 'striped umbrella', 'little wooden boat', 'basket of berries', 'paper lantern'];

  // Canonical 6-beat arc. Scene counts map onto it (see buildStory).
  var BEATS = [
    { key: 'hook', title: 'A Wonderful Morning', emotion: 'curious and happy', camera: 'Wide establishing shot, slow gentle push-in', speakers: ['milo', 'lina'] },
    { key: 'problem', title: 'Oh No, A Problem!', emotion: 'worried but hopeful', camera: 'Medium shot, slow push-in on the problem', speakers: ['lina', 'milo'] },
    { key: 'attempt', title: 'We Can Fix It', emotion: 'brave and determined', camera: 'Medium-wide shot, gentle pan following the action', speakers: ['milo', 'bobo'] },
    { key: 'setback', title: 'Not So Easy', emotion: 'surprised, then determined', camera: 'Close-up on faces, then a slow pull-back', speakers: ['lina', 'milo'] },
    { key: 'twist', title: 'A Happy Surprise', emotion: 'amazed and delighted', camera: 'Slow zoom-in on the surprise moment', speakers: ['bobo', 'lina'] },
    { key: 'ending', title: 'The Happy Ending', emotion: 'joyful and proud', camera: 'Wide happy shot, slow rise and gentle pull-back', speakers: ['milo', 'lina'] }
  ];

  function dialogueFor(beat, theme, rng) {
    var obj = pick(rng, LOST_OBJECTS);
    switch (beat) {
      case 'hook':
        return [
          { speaker: 'milo', line: 'Look! What a beautiful day for an adventure!' },
          { speaker: 'lina', line: 'Come on, let us see what we can find today!' }
        ];
      case 'problem':
        return [
          { speaker: 'lina', line: 'Oh no! We have a little problem here.' },
          { speaker: 'milo', line: 'Do not worry. We can fix this together!' }
        ];
      case 'attempt':
        return [
          { speaker: 'milo', line: 'I have an idea! Let us try it together.' },
          { speaker: 'bobo', line: 'Bobo helps! Bobo helps!' }
        ];
      case 'setback':
        return [
          { speaker: 'lina', line: 'Hmm, that did not work. What else can we try?' },
          { speaker: 'milo', line: 'We will not give up. Friends always find a way!' }
        ];
      case 'twist':
        return [
          { speaker: 'bobo', line: 'Look! Look! A happy surprise!' },
          { speaker: 'lina', line: 'Wow! That is wonderful!' }
        ];
      case 'ending':
        return [
          { speaker: 'milo', line: 'We did it! Together, we did it!' },
          { speaker: 'lina', line: 'This was the best day ever. Let us do it again tomorrow!' }
        ];
      default:
        return [{ speaker: 'milo', line: 'Let us keep going, friends!' }];
    }
  }

  function beatText(beatKey, theme) {
    switch (beatKey) {
      case 'hook': return theme.hook;
      case 'problem': return theme.problem;
      case 'attempt': return theme.attempt;
      case 'setback': return 'their first plan does not work, and they must think again';
      case 'twist': return theme.twist;
      case 'ending': return theme.ending;
      default: return theme.hook;
    }
  }

  // sceneCount: 4, 5 or 6. Returns { title, theme, moral, beats[] }.
  function buildStory(options) {
    options = options || {};
    var rng = makeRng(options.seed || ((Date.now() % 2147483647) + 1));
    var theme = THEMES[0];
    if (options.themeId) {
      for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].id === options.themeId) theme = THEMES[i];
      }
    } else {
      theme = pick(rng, THEMES);
    }
    var moral = pick(rng, MORALS);
    var count = options.sceneCount || 5;
    if (count < 4) count = 4;
    if (count > 6) count = 6;
    var chosen;
    if (count === 4) chosen = [BEATS[0], BEATS[1], BEATS[4], BEATS[5]];
    else if (count === 5) chosen = [BEATS[0], BEATS[1], BEATS[2], BEATS[4], BEATS[5]];
    else chosen = BEATS.slice();

    var beats = chosen.map(function (b) {
      var event = beatText(b.key, theme);
      var dialogue = dialogueFor(b.key, theme, rng);
      if (b.key === 'ending') {
        dialogue.push({ speaker: 'milo', line: moral });
      }
      return {
        beat: b.key,
        title: b.title,
        setting: theme.setting,
        event: event,
        emotion: b.emotion,
        camera: b.camera,
        sound: theme.sounds,
        dialogue: dialogue,
        endState: event + '.'
      };
    });

    return {
      title: theme.name,
      themeId: theme.id,
      themeName: theme.name,
      moral: moral,
      setting: theme.setting,
      props: theme.props.slice(),
      beats: beats
    };
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.story = {
    themes: THEMES,
    morals: MORALS,
    build: buildStory
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
