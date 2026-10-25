/* storage.js — Browser persistence for Milo & Lina Kids.
   Projects (stories, scenes, character descriptions, settings) live in
   localStorage. Character reference images live in IndexedDB (they are
   too big for localStorage), with an in-memory fallback if IndexedDB is
   unavailable. Nothing here ever talks to a server.
   LIMITATIONS (also shown in the app's Settings page):
   - Data is tied to ONE browser on ONE device. It does not sync to your
     other devices and is lost if you clear site data or uninstall the
     browser. Use Export regularly for backup.
   - localStorage holds roughly 5 MB per site; reference images are kept
     out of it for that reason and stored in IndexedDB instead.
   - Private/incognito mode may discard data when the session ends. */
(function (global) {
  'use strict';

  var PROJECTS_KEY = 'mlk_projects_v1';
  var ACTIVE_KEY = 'mlk_active_v1';
  var SETTINGS_KEY = 'mlk_settings_v1';

  function hasLocalStorage() {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) { return false; }
  }

  function readJson(key, fallback) {
    if (!hasLocalStorage()) return fallback;
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeJson(key, value) {
    if (!hasLocalStorage()) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  // ---- Projects ----
  function loadProjects() { return readJson(PROJECTS_KEY, []); }
  function saveProjects(projects) { return writeJson(PROJECTS_KEY, projects); }
  function loadActiveId() { return readJson(ACTIVE_KEY, null); }
  function saveActiveId(id) { return writeJson(ACTIVE_KEY, id); }
  function loadSettings() {
    return readJson(SETTINGS_KEY, { provider: 'demo', keys: {} });
  }
  function saveSettings(s) { return writeJson(SETTINGS_KEY, s); }
  function clearAll() {
    if (!hasLocalStorage()) return;
    try {
      localStorage.removeItem(PROJECTS_KEY);
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
    } catch (e) { /* ignore */ }
  }

  // ---- Reference images (IndexedDB, fallback: memory) ----
  var memoryImages = {};
  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      try {
        if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
        var req = indexedDB.open('mlk_db', 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { reject(e); }
    });
    return dbPromise;
  }

  function saveImage(id, dataUrl) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put(dataUrl, id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () {
      memoryImages[id] = dataUrl;
      return true;
    });
  }

  function getImage(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('images', 'readonly');
        var req = tx.objectStore('images').get(id);
        req.onsuccess = function () { resolve(req.result || memoryImages[id] || null); };
        req.onerror = function () { resolve(memoryImages[id] || null); };
      });
    }).catch(function () { return memoryImages[id] || null; });
  }

  function deleteImage(id) {
    delete memoryImages[id];
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').delete(id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(true); };
      });
    }).catch(function () { return true; });
  }

  global.MiloLina = global.MiloLina || {};
  global.MiloLina.storage = {
    loadProjects: loadProjects,
    saveProjects: saveProjects,
    loadActiveId: loadActiveId,
    saveActiveId: saveActiveId,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    clearAll: clearAll,
    saveImage: saveImage,
    getImage: getImage,
    deleteImage: deleteImage,
    hasLocalStorage: hasLocalStorage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
