# API Keys — Safety Rules for This Project

## The rule

**No API key, secret, token, or password may ever be committed to this
repository.** Not in code, not in docs, not in screenshots, not in a
"config" file.

## How Phase 1 handles keys

- Phase 1 makes **no network calls at all**. There is nothing to leak.
- The Settings page has optional key fields for future (Phase 2) providers.
  Anything typed there is stored **only in the user's own browser**
  (localStorage on their device). It is never uploaded, never synced, and
  never written into the repo.
- In Phase 2, an activated adapter reads the key from browser storage at
  call time and sends it only to that provider's own API endpoint.

## If a key is ever exposed by mistake

1. Revoke/rotate the key immediately in the provider's dashboard.
2. Remove it from the repo history (a normal delete is not enough — the key
   stays in git history) and push the cleaned history.
3. Treat any exposed key as compromised, even if it "looks unused".

## Files blocked by .gitignore

`.env`, `.env.*`, `*-keys.json`, `config.local.js`, `secrets.*`, and local
credential files are ignored so they cannot be committed accidentally.
