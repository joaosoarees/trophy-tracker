import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAchievement } from '@tests/factories/makeAchievement';

import {
  createChecklistItem,
  parseChecklist,
  restoreChecklistItem,
  shownProgress,
} from './checklist';
import {
  type IAchievementUserData,
  type IChecklistItem,
} from './types/UserData';

const NOW = new Date('2026-01-12T10:20:30.000Z');
/** What an id starts with while the clock is stopped at `NOW`. */
const STAMP = 'mkb0i46o';

/** A list the user already has, with one item on it. */
const listWithBridge = (): IChecklistItem[] => [
  { id: 'x', text: 'Bridge Kodama', done: true },
];

const userDataWith = (checklist: IChecklistItem[]): IAchievementUserData => ({
  note: '',
  pinned: false,
  checklist,
});

const bridge: IChecklistItem = { id: 'b', text: 'Bridge', done: false };
const cave: IChecklistItem = { id: 'c', text: 'Cave', done: false };
const tower: IChecklistItem = { id: 't', text: 'Tower', done: false };

/** Three items, two of them done. */
const twoOfThreeDone = (): IChecklistItem[] => [
  { id: '1', text: 'a', done: true },
  { id: '2', text: 'b', done: false },
  { id: '3', text: 'c', done: true },
];

describe('checklist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseChecklist', () => {
    it.each([
      { line: '- Bridge Kodama', text: 'Bridge Kodama' },
      { line: '* Cave Kodama', text: 'Cave Kodama' },
      { line: '3. Temple Kodama', text: 'Temple Kodama' },
      { line: '[ ] River Kodama', text: 'River Kodama' },
      { line: '  12) Tower Kodama  ', text: 'Tower Kodama' },
      { line: '- [x] 2. Lake Kodama', text: 'Lake Kodama' },
    ])(
      'should drop the marker and the spaces around when the line is "$line"',
      ({ line, text }) => {
        const items = parseChecklist(line);

        expect(items).toEqual([{ id: `${STAMP}-0`, text, done: false }]);
      },
    );

    it.each(['3 Kodamas in the village', 'Stage 2-1'])(
      'should keep the numbers when they are part of the name: %s',
      (line) => {
        const items = parseChecklist(line);

        expect(items).toEqual([{ id: `${STAMP}-0`, text: line, done: false }]);
      },
    );

    it('should create an unchecked item with its own id for each line when given several', () => {
      const items = parseChecklist('a\nb');

      expect(items).toEqual([
        { id: `${STAMP}-0`, text: 'a', done: false },
        { id: `${STAMP}-1`, text: 'b', done: false },
      ]);
    });

    it('should split the lines when they end the Windows way', () => {
      const items = parseChecklist('a\r\nb');

      expect(items).toEqual([
        { id: `${STAMP}-0`, text: 'a', done: false },
        { id: `${STAMP}-1`, text: 'b', done: false },
      ]);
    });

    it('should skip the line when it is blank', () => {
      const items = parseChecklist('a\n\n   \nb');

      expect(items).toEqual([
        { id: `${STAMP}-0`, text: 'a', done: false },
        { id: `${STAMP}-1`, text: 'b', done: false },
      ]);
    });

    it('should skip the line when it repeats an earlier one in another case', () => {
      const items = parseChecklist('New\nnew');

      expect(items).toEqual([{ id: `${STAMP}-0`, text: 'New', done: false }]);
    });

    it('should skip the line when it is already on the list in another case', () => {
      const existing = listWithBridge();

      const items = parseChecklist('bridge kodama\nNew', existing);

      expect(items).toEqual([{ id: `${STAMP}-1`, text: 'New', done: false }]);
    });
  });

  describe('shownProgress', () => {
    it('should count the done items of the checklist when Steam has no counter', () => {
      const achievement = makeAchievement();
      const data = userDataWith(twoOfThreeDone());

      const progress = shownProgress(achievement, data);

      expect(progress).toEqual({ current: 2, target: 3, source: 'checklist' });
    });

    it('should answer the Steam counter when the achievement has both', () => {
      const achievement = makeAchievement({
        progress: { current: 5, target: 9 },
      });
      const data = userDataWith(twoOfThreeDone());

      const progress = shownProgress(achievement, data);

      expect(progress).toEqual({ current: 5, target: 9, source: 'steam' });
    });

    it.each([
      { state: 'there is no user data', data: undefined },
      {
        state: 'the checklist is empty',
        data: { note: 'x', pinned: true, checklist: [] },
      },
    ])(
      'should answer null when Steam has no counter and $state',
      ({ data }) => {
        const achievement = makeAchievement();

        const progress = shownProgress(achievement, data);

        expect(progress).toBeNull();
      },
    );
  });

  describe('createChecklistItem', () => {
    it('should keep the marker when the text was typed by hand', () => {
      const existing = listWithBridge();

      const item = createChecklistItem('  1. First boss ', existing);

      expect(item).toEqual({
        id: `${STAMP}-1`,
        text: '1. First boss',
        done: false,
      });
    });

    it('should answer blank when the text is only spaces', () => {
      const existing = listWithBridge();

      const item = createChecklistItem('   ', existing);

      expect(item).toBe('blank');
    });

    it('should answer duplicate when the text is on the list in another case', () => {
      const existing = listWithBridge();

      const item = createChecklistItem('bridge kodama', existing);

      expect(item).toBe('duplicate');
    });
  });

  describe('restoreChecklistItem', () => {
    it('should put the item back where it was when the list is as it was left', () => {
      const items = [bridge, tower];

      const restored = restoreChecklistItem(items, cave, 1);

      expect(restored).toEqual([bridge, cave, tower]);
    });

    it('should keep what was changed meanwhile when the item is put back', () => {
      const items = [{ ...bridge, done: true }, tower];

      const restored = restoreChecklistItem(items, cave, 1);

      expect(restored).toEqual([{ ...bridge, done: true }, cave, tower]);
    });

    it('should put the item back at the end when the list got shorter than its place', () => {
      const items = [bridge];

      const restored = restoreChecklistItem(items, tower, 2);

      expect(restored).toEqual([bridge, tower]);
    });

    it('should answer the list it was given when the item is already on it', () => {
      const items = [bridge, cave, tower];

      const restored = restoreChecklistItem(items, cave, 0);

      expect(restored).toBe(items);
    });

    it('should answer the list it was given when another item has that text in another case', () => {
      const items = [bridge, { id: 'typed-again', text: 'cave', done: true }];

      const restored = restoreChecklistItem(items, cave, 1);

      expect(restored).toBe(items);
    });
  });
});
