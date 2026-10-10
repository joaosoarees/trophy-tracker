import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeGameView } from '@tests/factories/makeGameView';
import {
  KEY,
  makeTempDir,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';
import { InMemoryStore, type ServiceStore } from '@tests/InMemoryStore';
import { game } from '@tests/steamLibrary';

import { type ICipher, Store } from './Store';

const CREDENTIALS = { steamId: STEAM_ID, apiKey: KEY };
const PROFILE = { steamId: STEAM_ID, name: 'player', avatar: 'a.jpg' };
const OTHER_CREDENTIALS = { steamId: OTHER_STEAM_ID, apiKey: OTHER_KEY };
const OTHER_PROFILE = { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' };
const ACCOUNT = {
  ...PROFILE,
  keyEnding: KEY.slice(-4),
  isKeyEncrypted: false,
  status: 'valid',
};
const OTHER_ACCOUNT = {
  ...OTHER_PROFILE,
  keyEnding: OTHER_KEY.slice(-4),
  isKeyEncrypted: false,
  status: 'valid',
};

const GAMES = [game(1, 'A', 10)];
const LIBRARY = { fetchedAt: 5, games: GAMES };
const VIEW = makeGameView({ appid: 1 });
const SUMMARY = { total: 4, unlocked: 1, playtime: 10, lastUnlockAt: 900 };
const OTHER_SUMMARY = { total: 8, unlocked: 8, playtime: 30, lastUnlockAt: 7 };
const ART = { header: 'header.jpg', capsule: 'capsule.jpg' };
const OTHER_ART = { header: 'other-header.jpg', capsule: '' };
const SCHEMA = { fetchedAt: 5, items: [] };

const CIPHER: ICipher = {
  encrypt: (plain) => `enc:${plain}`,
  decrypt: (encoded) => encoded.slice(4),
};

/** A store, real or fake, as the services see it. */
interface IImplementation {
  name: string;
  /** A store with no account, in English, with nothing read. */
  make: () => ServiceStore;
  /**
   * A store whose only account, `STEAM_ID`, was saved with a keyring that is
   * not there any more.
   */
  makeWithLostKeyring: () => ServiceStore;
  /**
   * A store with no account, and what makes the disk under it refuse, from
   * then on, the accounts and the language: what a store writes at once.
   */
  makeRefusable: () => { sut: ServiceStore; refuseWrites: () => void };
}

/** The files the real store writes at once, of those the services change. */
const WRITTEN_AT_ONCE = ['config.json', 'settings.json'];

const IMPLEMENTATIONS: IImplementation[] = [
  {
    name: 'Store',
    make: () => new Store(makeTempDir()),
    makeWithLostKeyring: () => {
      const dir = makeTempDir();
      new Store(dir, CIPHER).setCredentials(CREDENTIALS, PROFILE);
      return new Store(dir);
    },
    makeRefusable: () => {
      const dir = makeTempDir();
      // A folder where a file is first written: nothing can be written over
      // it, on any system and whoever runs the tests.
      const refuseWrites = (): void =>
        WRITTEN_AT_ONCE.forEach((name) => mkdirSync(join(dir, `${name}.tmp`)));
      return { sut: new Store(dir), refuseWrites };
    },
  },
  {
    name: 'InMemoryStore',
    make: () => new InMemoryStore(),
    makeWithLostKeyring: () => {
      const store = new InMemoryStore();
      store.setCredentials(CREDENTIALS, PROFILE);
      store.loseKeyOf(STEAM_ID);
      return store;
    },
    makeRefusable: () => {
      const sut = new InMemoryStore();
      return { sut, refuseWrites: () => sut.refuseWrites() };
    },
  },
];

/** Everything a store says about its accounts. */
const accountsOf = (store: ServiceStore) => ({
  inUse: store.getActiveSteamId(),
  credentials: store.getCredentials(),
  profile: store.getProfile(),
  accounts: store.getAccounts(),
});

/** The three things kept per account, each written and read the same way. */
const PER_ACCOUNT = [
  {
    what: 'library',
    write: (store: ServiceStore, owner?: string) =>
      store.setLibrary(GAMES, 5, owner),
    read: (store: ServiceStore): unknown => store.getLibrary() ?? null,
    value: LIBRARY as unknown,
  },
  {
    what: 'game',
    write: (store: ServiceStore, owner?: string) => store.setGame(VIEW, owner),
    read: (store: ServiceStore): unknown => store.getGame(1),
    value: VIEW as unknown,
  },
  {
    what: 'summary',
    write: (store: ServiceStore, owner?: string) =>
      store.setSummaries({ 1: SUMMARY }, owner),
    read: (store: ServiceStore): unknown => store.getSummary(1),
    value: SUMMARY as unknown,
  },
];

/**
 * The two a read asks for by the account it started for, since another may
 * be in use by the time it needs them.
 */
const ASKED_BY_OWNER = [
  {
    what: 'library',
    write: (store: ServiceStore, owner?: string) =>
      store.setLibrary(GAMES, 5, owner),
    read: (store: ServiceStore, owner: string): unknown =>
      store.getLibrary(owner) ?? null,
    value: LIBRARY as unknown,
  },
  {
    what: 'summary',
    write: (store: ServiceStore, owner?: string) =>
      store.setSummaries({ 1: SUMMARY }, owner),
    read: (store: ServiceStore, owner: string): unknown =>
      store.getSummary(1, owner),
    value: SUMMARY as unknown,
  },
];

/**
 * What `Tracker`, `SetupService`, `AccountChecks` and `KeyStatus` rely on in
 * a store, asserted of the real `Store` and of the fake their specs run over. A difference is a fault of
 * the fake.
 */
describe.each(IMPLEMENTATIONS)(
  'what the services rely on in $name',
  ({ make, makeWithLostKeyring, makeRefusable }) => {
    /** A store with `STEAM_ID` saved, and in use. */
    function setupWithAccount() {
      const sut = make();
      sut.setCredentials(CREDENTIALS, PROFILE);
      return { sut };
    }

    /** Two accounts; the second one saved, `OTHER_STEAM_ID`, is in use. */
    function setupWithTwoAccounts() {
      const { sut } = setupWithAccount();
      sut.setCredentials(OTHER_CREDENTIALS, OTHER_PROFILE);
      return { sut };
    }

    describe('accounts', () => {
      it('should have no account in use when none was saved', () => {
        const sut = make();

        const state = accountsOf(sut);

        expect(state).toEqual({
          inUse: null,
          credentials: null,
          profile: null,
          accounts: [],
        });
      });

      it('should put an account in use when its credentials are saved', () => {
        const sut = make();

        sut.setCredentials(CREDENTIALS, PROFILE);

        expect(accountsOf(sut)).toEqual({
          inUse: STEAM_ID,
          credentials: CREDENTIALS,
          profile: PROFILE,
          accounts: [ACCOUNT],
        });
      });

      it('should put the second account in use, after the first in the list, when it is saved', () => {
        const { sut } = setupWithAccount();

        sut.setCredentials(OTHER_CREDENTIALS, OTHER_PROFILE);

        expect(accountsOf(sut)).toEqual({
          inUse: OTHER_STEAM_ID,
          credentials: OTHER_CREDENTIALS,
          profile: OTHER_PROFILE,
          accounts: [ACCOUNT, OTHER_ACCOUNT],
        });
      });

      it('should give an account its new key, keep its place and put it in use when it is saved again', () => {
        const { sut } = setupWithTwoAccounts();

        sut.setCredentials({ steamId: STEAM_ID, apiKey: OTHER_KEY }, PROFILE);

        expect(accountsOf(sut)).toEqual({
          inUse: STEAM_ID,
          credentials: { steamId: STEAM_ID, apiKey: OTHER_KEY },
          profile: PROFILE,
          accounts: [
            { ...ACCOUNT, keyEnding: OTHER_KEY.slice(-4) },
            OTHER_ACCOUNT,
          ],
        });
      });

      it('should give an account its new key and stay on the account in use when told not to follow it', () => {
        const { sut } = setupWithTwoAccounts();

        sut.setCredentials({ steamId: STEAM_ID, apiKey: OTHER_KEY }, PROFILE, {
          shouldFollow: false,
        });

        expect({
          inUse: sut.getActiveSteamId(),
          saved: sut.getCredentialsOf(STEAM_ID),
        }).toEqual({
          inUse: OTHER_STEAM_ID,
          saved: { steamId: STEAM_ID, apiKey: OTHER_KEY },
        });
      });

      it('should mark a key as valid again when its account is saved again', () => {
        const { sut } = setupWithAccount();
        sut.setAccountStatus(STEAM_ID, 'rejected');

        sut.setCredentials(CREDENTIALS, PROFILE);

        expect(sut.getAccounts()).toEqual([ACCOUNT]);
      });

      it('should answer true and put a saved account in use when asked to follow it', () => {
        const { sut } = setupWithTwoAccounts();

        const isFollowing = sut.setActiveAccount(STEAM_ID);

        expect(isFollowing).toBe(true);
        expect(accountsOf(sut)).toEqual({
          inUse: STEAM_ID,
          credentials: CREDENTIALS,
          profile: PROFILE,
          accounts: [ACCOUNT, OTHER_ACCOUNT],
        });
      });

      it('should answer false and stay on the account in use when asked to follow one that was not saved', () => {
        const { sut } = setupWithTwoAccounts();

        const isFollowing = sut.setActiveAccount(UNKNOWN_STEAM_ID);

        expect(isFollowing).toBe(false);
        expect(sut.getActiveSteamId()).toBe(OTHER_STEAM_ID);
      });

      it('should answer the credentials of a saved account when it is not the one in use', () => {
        const { sut } = setupWithTwoAccounts();

        const credentials = sut.getCredentialsOf(STEAM_ID);

        expect(credentials).toEqual(CREDENTIALS);
      });

      it('should answer no credentials when the account was not saved', () => {
        const { sut } = setupWithTwoAccounts();

        const credentials = sut.getCredentialsOf(UNKNOWN_STEAM_ID);

        expect(credentials).toBeNull();
      });

      it.each([
        { steamId: STEAM_ID, what: 'a saved account', isSaved: true },
        { steamId: UNKNOWN_STEAM_ID, what: 'one not saved', isSaved: false },
      ])(
        'should say whether it has the account when asked about $what',
        ({ steamId, isSaved }) => {
          const { sut } = setupWithAccount();

          const hasAccount = sut.hasAccount(steamId);

          expect(hasAccount).toBe(isSaved);
        },
      );

      it('should list an account with the status its key was last given', () => {
        const { sut } = setupWithTwoAccounts();

        sut.setAccountStatus(STEAM_ID, 'rateLimited');

        expect(sut.getAccounts()).toEqual([
          { ...ACCOUNT, status: 'rateLimited' },
          OTHER_ACCOUNT,
        ]);
      });

      it('should change nothing when given the status of an account that was not saved', () => {
        const { sut } = setupWithTwoAccounts();

        sut.setAccountStatus(UNKNOWN_STEAM_ID, 'rejected');

        expect(sut.getAccounts()).toEqual([ACCOUNT, OTHER_ACCOUNT]);
      });

      it('should leave a list it already answered as it was when a status changes afterwards', () => {
        const { sut } = setupWithAccount();
        const listed = sut.getAccounts();

        sut.setAccountStatus(STEAM_ID, 'rejected');

        expect(listed).toEqual([ACCOUNT]);
      });

      it('should put the first account left in use when the one in use is removed', () => {
        const { sut } = setupWithTwoAccounts();

        sut.removeAccount(OTHER_STEAM_ID);

        expect(accountsOf(sut)).toEqual({
          inUse: STEAM_ID,
          credentials: CREDENTIALS,
          profile: PROFILE,
          accounts: [ACCOUNT],
        });
      });

      it('should stay on the account in use when another is removed', () => {
        const { sut } = setupWithTwoAccounts();

        sut.removeAccount(STEAM_ID);

        expect(accountsOf(sut)).toEqual({
          inUse: OTHER_STEAM_ID,
          credentials: OTHER_CREDENTIALS,
          profile: OTHER_PROFILE,
          accounts: [OTHER_ACCOUNT],
        });
      });

      it('should have no account in use when the last one is removed', () => {
        const { sut } = setupWithAccount();

        sut.removeAccount(STEAM_ID);

        expect(accountsOf(sut)).toEqual({
          inUse: null,
          credentials: null,
          profile: null,
          accounts: [],
        });
      });

      it('should change nothing when asked to remove an account that was not saved', () => {
        const { sut } = setupWithTwoAccounts();

        sut.removeAccount(UNKNOWN_STEAM_ID);

        expect(accountsOf(sut)).toEqual({
          inUse: OTHER_STEAM_ID,
          credentials: OTHER_CREDENTIALS,
          profile: OTHER_PROFILE,
          accounts: [ACCOUNT, OTHER_ACCOUNT],
        });
      });
    });

    describe('an account whose key cannot be read', () => {
      it('should answer no credentials while still listing the account and keeping it in use', () => {
        const sut = makeWithLostKeyring();

        const state = accountsOf(sut);

        expect(state).toEqual({
          inUse: STEAM_ID,
          credentials: null,
          profile: PROFILE,
          accounts: [{ ...ACCOUNT, isKeyEncrypted: true }],
        });
      });

      it('should answer no credentials when asked for that account by its SteamID', () => {
        const sut = makeWithLostKeyring();

        const credentials = sut.getCredentialsOf(STEAM_ID);

        expect(credentials).toBeNull();
      });

      it('should still say it has the account', () => {
        const sut = makeWithLostKeyring();

        const hasAccount = sut.hasAccount(STEAM_ID);

        expect(hasAccount).toBe(true);
      });

      it('should answer the credentials again when the account is saved with a key anew', () => {
        const sut = makeWithLostKeyring();

        sut.setCredentials(CREDENTIALS, PROFILE);

        expect(accountsOf(sut)).toEqual({
          inUse: STEAM_ID,
          credentials: CREDENTIALS,
          profile: PROFILE,
          accounts: [ACCOUNT],
        });
      });
    });

    describe('what was read for an account', () => {
      it.each(PER_ACCOUNT)(
        'should answer no $what when none was read',
        ({ read }) => {
          const { sut } = setupWithAccount();

          const answer = read(sut);

          expect(answer).toBeNull();
        },
      );

      it.each(PER_ACCOUNT)(
        'should answer the $what read for the account in use',
        ({ write, read, value }) => {
          const { sut } = setupWithAccount();

          write(sut);

          expect(read(sut)).toEqual(value);
        },
      );

      it.each(PER_ACCOUNT)(
        'should not answer the $what read for one account when another is in use',
        ({ write, read }) => {
          const { sut } = setupWithTwoAccounts();
          write(sut);

          sut.setActiveAccount(STEAM_ID);

          expect(read(sut)).toBeNull();
        },
      );

      it.each(PER_ACCOUNT)(
        'should answer the $what read for an account when it is in use again',
        ({ write, read, value }) => {
          const { sut } = setupWithTwoAccounts();
          write(sut);
          sut.setActiveAccount(STEAM_ID);

          sut.setActiveAccount(OTHER_STEAM_ID);

          expect(read(sut)).toEqual(value);
        },
      );

      it.each(PER_ACCOUNT)(
        'should not hand the account in use a $what read for another',
        ({ write, read }) => {
          const { sut } = setupWithTwoAccounts();

          write(sut, STEAM_ID);

          expect(read(sut)).toBeNull();
        },
      );

      it.each(PER_ACCOUNT)(
        'should keep a $what read for an account not in use until that one is',
        ({ write, read, value }) => {
          const { sut } = setupWithTwoAccounts();
          write(sut, STEAM_ID);

          sut.setActiveAccount(STEAM_ID);

          expect(read(sut)).toEqual(value);
        },
      );

      it.each(PER_ACCOUNT)(
        'should discard a $what read for an account that was removed',
        ({ write, read }) => {
          const { sut } = setupWithTwoAccounts();
          sut.removeAccount(STEAM_ID);
          write(sut, STEAM_ID);

          sut.setCredentials(CREDENTIALS, PROFILE);

          expect(read(sut)).toBeNull();
        },
      );

      it.each(PER_ACCOUNT)(
        'should forget the $what of an account when it is removed',
        ({ write, read }) => {
          const { sut } = setupWithAccount();
          write(sut);
          sut.removeAccount(STEAM_ID);

          sut.setCredentials(CREDENTIALS, PROFILE);

          expect(read(sut)).toBeNull();
        },
      );

      it.each(PER_ACCOUNT)(
        'should keep the $what of an account when its key is replaced',
        ({ write, read, value }) => {
          const { sut } = setupWithAccount();
          write(sut);

          sut.setCredentials({ steamId: STEAM_ID, apiKey: OTHER_KEY }, PROFILE);

          expect(read(sut)).toEqual(value);
        },
      );

      it.each(PER_ACCOUNT)(
        'should not show an account the $what read while there was none',
        ({ write, read }) => {
          const sut = make();
          write(sut);

          sut.setCredentials(CREDENTIALS, PROFILE);

          expect(read(sut)).toBeNull();
        },
      );

      it.each(ASKED_BY_OWNER)(
        'should answer the $what of an account when asked for it while another is in use',
        ({ write, read, value }) => {
          const { sut } = setupWithTwoAccounts();
          write(sut, STEAM_ID);

          const answer = read(sut, STEAM_ID);

          expect(answer).toEqual(value);
        },
      );

      it.each(ASKED_BY_OWNER)(
        'should not answer the $what of the account in use when asked for that of another',
        ({ write, read }) => {
          const { sut } = setupWithTwoAccounts();
          write(sut);

          const answer = read(sut, STEAM_ID);

          expect(answer).toBeNull();
        },
      );

      it.each(ASKED_BY_OWNER)(
        'should answer no $what when asked for that of an account that was removed',
        ({ write, read }) => {
          const { sut } = setupWithTwoAccounts();
          write(sut, STEAM_ID);
          sut.removeAccount(STEAM_ID);

          const answer = read(sut, STEAM_ID);

          expect(answer).toBeNull();
        },
      );

      it('should answer the very game it was given, not a copy', () => {
        const { sut } = setupWithAccount();

        sut.setGame(VIEW);

        expect(sut.getGame(1)).toBe(VIEW);
      });

      it('should keep the summaries it had when given others', () => {
        const { sut } = setupWithAccount();
        sut.setSummaries({ 1: SUMMARY });

        sut.setSummaries({ 2: OTHER_SUMMARY });

        expect([sut.getSummary(1), sut.getSummary(2)]).toEqual([
          SUMMARY,
          OTHER_SUMMARY,
        ]);
      });

      it('should answer the last summary given for a game', () => {
        const { sut } = setupWithAccount();
        sut.setSummaries({ 1: SUMMARY });

        sut.setSummaries({ 1: OTHER_SUMMARY });

        expect(sut.getSummary(1)).toEqual(OTHER_SUMMARY);
      });
    });

    describe('what describes a game, whoever plays it', () => {
      it('should answer no achievement list when none was read', () => {
        const sut = make();

        const schema = sut.getSchema(1);

        expect(schema).toBeNull();
      });

      it('should answer the achievement list of a game to every account', () => {
        const { sut } = setupWithTwoAccounts();
        sut.setSchema(1, [], 5);

        sut.setActiveAccount(STEAM_ID);

        expect(sut.getSchema(1)).toEqual(SCHEMA);
      });

      it('should answer no art when none was read', () => {
        const sut = make();

        const art = sut.getArt(1);

        expect(art).toBeNull();
      });

      it('should answer the art of a game to every account', () => {
        const { sut } = setupWithTwoAccounts();
        sut.setArt(new Map([[1, ART]]));

        sut.setActiveAccount(STEAM_ID);

        expect(sut.getArt(1)).toEqual(ART);
      });

      it('should keep the art it had when given the art of other games', () => {
        const sut = make();
        sut.setArt(new Map([[1, ART]]));

        sut.setArt(new Map([[2, OTHER_ART]]));

        expect([sut.getArt(1), sut.getArt(2)]).toEqual([ART, OTHER_ART]);
      });
    });

    describe('language', () => {
      /** Two accounts with everything read, the same for both. */
      function setupWithReads() {
        const { sut } = setupWithTwoAccounts();
        for (const owner of [STEAM_ID, OTHER_STEAM_ID]) {
          sut.setLibrary(GAMES, 5, owner);
          sut.setGame(VIEW, owner);
          sut.setSummaries({ 1: SUMMARY }, owner);
        }
        sut.setSchema(1, [], 5);
        sut.setArt(new Map([[1, ART]]));
        return { sut };
      }

      /** Everything read that the account in use can see. */
      const readsOf = (store: ServiceStore) => ({
        library: store.getLibrary(),
        game: store.getGame(1),
        summary: store.getSummary(1),
        schema: store.getSchema(1),
        art: store.getArt(1),
      });

      it('should answer English when no language was chosen', () => {
        const sut = make();

        const language = sut.getLanguage();

        expect(language).toBe('en');
      });

      it('should answer the language that was chosen', () => {
        const sut = make();

        sut.setLanguage('pt-BR');

        expect(sut.getLanguage()).toBe('pt-BR');
      });

      it('should drop what Steam sent translated and keep the rest when the language changes', () => {
        const { sut } = setupWithReads();

        sut.setLanguage('pt-BR');

        expect(readsOf(sut)).toEqual({
          library: LIBRARY,
          game: null,
          summary: SUMMARY,
          schema: null,
          art: null,
        });
      });

      it('should drop the games of an account that is not in use when the language changes', () => {
        const { sut } = setupWithReads();
        sut.setLanguage('pt-BR');

        sut.setActiveAccount(STEAM_ID);

        expect(readsOf(sut)).toEqual({
          library: LIBRARY,
          game: null,
          summary: SUMMARY,
          schema: null,
          art: null,
        });
      });

      it('should drop nothing when the language chosen is the one it is in', () => {
        const { sut } = setupWithReads();

        sut.setLanguage('en');

        expect(readsOf(sut)).toEqual({
          library: LIBRARY,
          game: VIEW,
          summary: SUMMARY,
          schema: SCHEMA,
          art: ART,
        });
      });
    });

    describe('a write the disk refuses', () => {
      /**
       * Two accounts with everything read, following `OTHER_STEAM_ID`, whose
       * key Steam last rejected, over a disk that then refuses every write.
       */
      function setupRefusing() {
        const { sut, refuseWrites } = makeRefusable();
        sut.setCredentials(CREDENTIALS, PROFILE);
        sut.setCredentials(OTHER_CREDENTIALS, OTHER_PROFILE);
        sut.setAccountStatus(OTHER_STEAM_ID, 'rejected');
        sut.setGame(VIEW, STEAM_ID);
        sut.setSummaries({ 1: SUMMARY }, STEAM_ID);
        sut.setSchema(1, [], 5);
        refuseWrites();
        return { sut };
      }

      /** Everything a refused write could have changed. */
      const heldBy = (store: ServiceStore) => ({
        ...accountsOf(store),
        language: store.getLanguage(),
        schema: store.getSchema(1),
        summaryOfFirst: store.getSummary(1, STEAM_ID),
      });

      /** Whether the store said, by throwing, that it could not write. */
      const hasRefused = (write: () => unknown): boolean => {
        try {
          write();
          return false;
        } catch {
          return true;
        }
      };

      it.each<[string, (store: ServiceStore) => unknown]>([
        [
          'a new account is saved',
          (store) =>
            store.setCredentials(
              { steamId: UNKNOWN_STEAM_ID, apiKey: KEY },
              { steamId: UNKNOWN_STEAM_ID, name: 'new', avatar: '' },
            ),
        ],
        [
          'a saved account is given another key',
          (store) =>
            store.setCredentials(
              { steamId: STEAM_ID, apiKey: OTHER_KEY },
              { ...PROFILE, name: 'renamed' },
            ),
        ],
        [
          'a key is replaced without following its account',
          (store) =>
            store.setCredentials(
              { steamId: STEAM_ID, apiKey: OTHER_KEY },
              { ...PROFILE, name: 'renamed' },
              { shouldFollow: false },
            ),
        ],
        [
          'another account is followed',
          (store) => store.setActiveAccount(STEAM_ID),
        ],
        [
          'a key is given another status',
          (store) => store.setAccountStatus(OTHER_STEAM_ID, 'valid'),
        ],
        [
          'the account in use is removed',
          (store) => store.removeAccount(OTHER_STEAM_ID),
        ],
        [
          'an account that is not in use is removed',
          (store) => store.removeAccount(STEAM_ID),
        ],
        ['the language changes', (store) => store.setLanguage('pt-BR')],
      ])('should say so and change nothing when %s', (_change, write) => {
        const { sut } = setupRefusing();

        const hasThrown = hasRefused(() => write(sut));

        expect({ hasThrown, held: heldBy(sut) }).toEqual({
          hasThrown: true,
          held: {
            inUse: OTHER_STEAM_ID,
            credentials: OTHER_CREDENTIALS,
            profile: OTHER_PROFILE,
            accounts: [ACCOUNT, { ...OTHER_ACCOUNT, status: 'rejected' }],
            language: 'en',
            schema: SCHEMA,
            summaryOfFirst: SUMMARY,
          },
        });
      });

      it('should say nothing when asked to follow an account that was not saved', () => {
        const { sut } = setupRefusing();

        const hasFollowed = sut.setActiveAccount(UNKNOWN_STEAM_ID);

        expect(hasFollowed).toBe(false);
      });

      it('should say nothing when the language chosen is the one it is in', () => {
        const { sut } = setupRefusing();

        sut.setLanguage('en');

        expect(sut.getLanguage()).toBe('en');
      });

      it('should still take what is read from Steam, which is written later', () => {
        const { sut } = setupRefusing();

        sut.setGame(VIEW);

        expect(sut.getGame(1)).toEqual(VIEW);
      });
    });

    describe('list orders', () => {
      it('should answer the default order of the achievements', () => {
        const sut = make();

        const sort = sut.getAchievementSort();

        expect(sort).toEqual({ pending: 'common', unlocked: 'recent' });
      });

      it('should answer the default order of the dashboard', () => {
        const sut = make();

        const sort = sut.getDashboardSort();

        expect(sort).toEqual({ ongoing: 'closest', complete: 'completed' });
      });
    });
  },
);
