import {
  parseStats, parseToken, statTokens, parseMarkup, markupChanges, applyChange,
} from '../stats';

const STATS = parseStats([
  'A  attack   f55  gear',
  'D  defense  58f  gear',
  'H  hearing  fd4',
  'R  anger    f44',
]);

// Plain text of the first paragraph, with each span shown as [code op value|phrase].
function marked(markup) {
  const { text, spans } = parseMarkup(markup, STATS).paragraphs[0];
  let out = '';
  let cursor = 0;
  spans.forEach(({ start, end, code, op, value }) => {
    const change = op === 'set' ? `${value}` : op === 'add' ? `${value >= 0 ? '+' : ''}${value}` : '';
    out += `${text.slice(cursor, start)}[${code}${change}|${text.slice(start, end)}]`;
    cursor = end;
  });
  return out + text.slice(cursor);
}

export default function register({ describe, it, expect }) {
  describe('parseStats', () => {
    it('reads code, name, color and gear', () => {
      expect(STATS[0]).toEqual({ code: 'A', name: 'attack', color: '#f55', gear: true });
      expect(STATS[2]).toEqual({ code: 'H', name: 'hearing', color: '#fd4', gear: false });
    });
  });

  describe('stat tokens', () => {
    it('read a declared code or name with a number', () => {
      expect(parseToken('H2', STATS)).toEqual({ code: 'H', value: 2 });
      expect(parseToken('H2.1', STATS)).toEqual({ code: 'H', value: 2.1 });
      expect(parseToken('R-1', STATS)).toEqual({ code: 'R', value: -1 });
      expect(parseToken('hearing3', STATS)).toEqual({ code: 'H', value: 3 });
    });

    it('leave undeclared codes as ordinary words', () => {
      expect(parseToken('Z2', STATS)).toBeNull();
      expect(parseToken('H', STATS)).toBeNull();
      expect(parseToken('Room1', STATS)).toBeNull();
    });

    it("come from a map line's value-less attributes", () => {
      expect(statTokens({ H2: undefined, R0: undefined, key: 'Bat-shaped key', Z9: undefined }, STATS))
        .toEqual({ H: 2, R: 0 });
    });
  });

  describe('dialogue markup', () => {
    it('runs an ALL CAPS phrase until the capitals run out', () => {
      expect(marked('"R+1:HEY! WHO ARE YOU? Keep it down."')).toBe('"[R+1|HEY! WHO ARE YOU?] Keep it down."');
    });

    it('ends a lowercase phrase at the next punctuation', () => {
      expect(marked('She sighs. R1:her shoulders drop, finally.')).toBe('She sighs. [R1|her shoulders drop], finally.');
    });

    it('lets a closing colon guard a phrase with commas in it', () => {
      expect(marked('R1:fine, whatever, go on: she says.')).toBe('[R1|fine, whatever, go on] she says.');
    });

    it('runs a double-colon phrase to the end of its line', () => {
      expect(marked('R0::calm now, truly. Really.\nNext line.')).toBe('[R0|calm now, truly. Really.] Next line.');
    });

    it('reads relative changes and full names', () => {
      expect(marked('R-2:less.')).toBe('[R-2|less].');
      expect(marked('anger+1:more.')).toBe('[R+1|more].');
    });

    it('only highlights when there is no number', () => {
      expect(parseMarkup('H:sharp ears.', STATS).paragraphs[0].spans[0]).toMatchObject({ code: 'H', op: null, value: null });
    });

    it('leaves undeclared codes, mid-word codes and times alone', () => {
      expect(marked('Note: open at 3:00. HAR:no.')).toBe('Note: open at 3:00. HAR:no.');
    });

    it('does not mistake a following marker for a guard colon', () => {
      expect(marked('H1:quiet, R2:LOUD')).toBe('[H1|quiet], [R2|LOUD]');
    });

    it('collapses single line breaks and splits paragraphs on blank lines', () => {
      const { paragraphs } = parseMarkup('one\n  two\n\nthree', STATS);
      expect(paragraphs.map((p) => p.text)).toEqual(['one two', 'three']);
    });

    it('leaves text without markers exactly as it was', () => {
      const text = 'Jacinthe is a tavern owner.  She lets travelers rest for 1gp.';
      expect(parseMarkup(text, STATS).paragraphs).toEqual([{ text, spans: [] }]);
    });

    it('lists the changes a text makes', () => {
      expect(markupChanges('H:ears. R+1:HEY! R0:calm.', STATS)).toEqual([
        { code: 'R', op: 'add', value: 1, phrase: 'HEY!' },
        { code: 'R', op: 'set', value: 0, phrase: 'calm' },
      ]);
    });
  });

  describe('applyChange', () => {
    it('sets, adds, or leaves alone', () => {
      expect(applyChange(3, { op: 'set', value: 1 })).toBe(1);
      expect(applyChange(3, { op: 'add', value: -1 })).toBe(2);
      expect(applyChange(undefined, { op: 'add', value: 1 })).toBe(1);
      expect(applyChange(3, { op: null, value: null })).toBe(3);
    });
  });
}
