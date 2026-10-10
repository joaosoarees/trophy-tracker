# Local data

The rules below are binding; `CLAUDE.md` sends you here before you change `storage/Store.ts`, what a file in the data folder holds, or how a file is read, written or versioned.

The folder is `~/.config/trophy-tracker/` (`%APPDATA%\trophy-tracker` on Windows, `~/Library/Application Support/trophy-tracker` on macOS):

- `config.json`: the accounts, each with its SteamID and key; permission 600; keys encrypted only if there is a keyring.
- `cache.json`: per account, plus what is common to all.
- `userdata.json`: notes, pins and checklists, per account.
- `settings.json`: language, always on top, list orders, the window's size and position.

## Rules

- **`cache.json` records the language it was read in** and is dropped on startup if it does not match the language in `settings.json`. Changing the language drops the translated cache (games, achievement lists, art).

- Never copy the key out of that folder or print it: the rule is in `CLAUDE.md`, because it holds for any work in the repository.
- **A file is never lost to a bad write or a bad read** (`storage/Store.ts`). Writing goes to a temporary name and is then put in place.
- **A file that cannot be parsed, or whose content is not a JSON object, is copied to `<name>.damaged.bak`** before the app starts from nothing for that file, and the error log says so. This holds for all four files, `cache.json` included. Never treat such a file as empty: the next write would erase it for good.
- **Every file carries the version of its format** (`FILE_VERSION`, 2 today). A file with no version counts as version 1. A file in the app's version is read. A file in any other version, older or later:

  | File                           | Older version                                                      | Later version                                                                  |
  | ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
  | `config.json`, `userdata.json` | not read; copied to `<name>.v<N>.bak`; the app starts from nothing | the same: not read; copied to `<name>.v<N>.bak`; the app starts from nothing   |
  | `cache.json`                   | not read; dropped with no copy: Steam gives it all back            | the same: not read; dropped with no copy                                       |
  | `settings.json`                | read: it never changed shape                                       | not read; copied to `settings.json.v<N>.bak`; the app starts from the defaults |

- `<N>` is the version the file says. A copy set aside gets permission 600: it may hold a key. The error log names each file set aside (`<name> could not be used (<reason>); kept as <copy>`).
- If the copy itself cannot be made, the error log says so and the app still starts from nothing for that file.
- **Migrations: only for a format a published version wrote, and with their way out written beside them.** Write one only when installed copies of the app have that data, never for a format that only existed on the developer's machine. Its comment says when it can go ("remove once nothing below version X is in use"), and it goes then. There is none today.
- **The store keeps nothing it could not write.** `config.json`, `settings.json` and `userdata.json` are written at once, and what `Store` holds in memory changes only after the file took it: a write the disk refuses throws out of the call that asked, and the store goes on answering what it answered before, which is what the file holds. Nothing in memory is ahead of those files, so a later write cannot carry along a change that was refused, and a restart brings back nothing the app was not already showing. In the code: never change `config`, `settings` or `userData` in place; build the next content and hand it to `saveConfig`, `saveSettings` or `saveUserData`.
- **A removal writes two files, the accounts first, then the notes.** When the notes cannot be written, the account is written back: the removal is refused whole and can be asked again. An account gone with its notes still in `userdata.json` would get them back if it were added anew. If the disk refuses that second write too, the account stays removed, as `config.json` says, and the caller is told all the same.
- **`cache.json` is the exception:** what was read from Steam is taken at once and written later (below), so nobody can be told of a write that fails. Memory then stays ahead of the file until a later write works; the failure reaches the error log as an uncaught exception of the main process. Nothing of the user's is lost: Steam gives it all back, and a cache left in another language is dropped as the app opens.
- **Who asked decides what a refused write means** (`docs/accounts.md`): a call from the interface rejects, and the interface says so; the status of a key is only logged, since the read it was learnt from worked; an account the app could not follow by itself is tried again at the next look.
- **The cache is written once, a second after it changes** (`cacheDelay`), and when the app closes (`Store.flush` on `before-quit`). Tests build the store with no delay.
