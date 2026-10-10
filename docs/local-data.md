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
- **The cache is written once, a second after it changes** (`cacheDelay`), and when the app closes (`Store.flush` on `before-quit`). Tests build the store with no delay.
