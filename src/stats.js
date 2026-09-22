// Stats: declared once in game.txt, written as compact tokens (H2, R-1.5) on
// map lines, and marked up in dialogue as phrases that highlight in the
// stat's color and can change a character's value.
//
//   Stats            in game.txt: code, name, color, and optionally `gear`
//   A  attack   f55  gear      (summed from what's worn)
//   H  hearing  fd4

const NUMBER = /[+-]?\d+(?:\.\d+)?/.source;

// Parse the lines of game.txt's Stats section.
export function parseStats(lines=[]) {
  return lines.map((line) => {
    const [code, name, color, ...rest] = line.trim().split(/\s+/);
    if (!code || !name) return null;
    return { code, name, color: color ? `#${color}` : null, gear: rest.includes('gear') };
  }).filter(Boolean);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The declared stat for a code or a full name, or null.
export function findStat(stats, codeOrName) {
  return stats.find(({ code, name }) => code === codeOrName || name === codeOrName) || null;
}

// A stat token like H2, H2.1, R-1 or hearing3, as { code, value }, or null
// when it isn't one (an undeclared code stays an ordinary word).
export function parseToken(token, stats) {
  const match = new RegExp(`^([A-Za-z]+)(${NUMBER})$`).exec(token);
  const stat = match && findStat(stats, match[1]);
  return stat ? { code: stat.code, value: Number(match[2]) } : null;
}

// The stat tokens among a map line's attributes (#H2#R0 parse to keys with
// no value), as { code: value }.
export function statTokens(attributes={}, stats) {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value === undefined)
      .map(([key]) => parseToken(key, stats))
      .filter(Boolean)
      .map(({ code, value }) => [code, value])
  );
}

// A marker: a declared code or name, an optional number, and a colon (two
// colons: the phrase runs to the end of the line).  It must start a word.
function markerPattern(stats) {
  const names = stats.flatMap(({ code, name }) => [code, name])
    .sort((a, b) => b.length - a.length)
    .map(escape);
  if (!names.length) return null;
  return new RegExp(`(^|[^\\w])(${names.join('|')})(${NUMBER})?(::?)`, 'g');
}

const isCaps = (word) => /[A-Z]/.test(word) && !/[a-z]/.test(word);

// Where a phrase starting at `from` ends in `source`, and where scanning
// resumes after it (past a guard colon, if one closed the phrase).
function phraseEnd(source, from, wholeLine, isMarkerColon) {
  if (wholeLine) {
    const end = source.indexOf('\n', from);
    return end < 0 ? [source.length, source.length] : [end, end];
  }

  // ALL CAPS: the run of capitalized words.
  const firstWord = /^\S+/.exec(source.slice(from))?.[0] || '';
  if (isCaps(firstWord)) {
    let end = from;
    const words = /\S+/g;
    words.lastIndex = from;
    let match;
    while ((match = words.exec(source)) && isCaps(match[0])) {
      if (source.slice(end, match.index).trim() !== '') break;
      end = match.index + match[0].length;
    }
    return [end, end];
  }

  // A closing colon before the sentence ends guards a phrase with commas in it.
  const sentenceEnd = source.slice(from).search(/[.!?]/);
  const limit = sentenceEnd < 0 ? source.length : from + sentenceEnd;
  for (let i = from; i < limit; i++) {
    if (source[i] === ':' && !isMarkerColon(i)) return [i, i + 1];
  }

  // Otherwise the next punctuation ends it.
  const stop = source.slice(from).search(/[.,!?;]/);
  const end = stop < 0 ? source.length : from + stop;
  return [end, end];
}

// Parse marked-up text into paragraphs of plain text and phrase spans:
//   { paragraphs: [{ text, spans: [{ start, end, code, op, value }] }] }
// `op` is 'set' (R1), 'add' (R+1, R-2), or null (R: only highlights).
// Single line breaks collapse into spaces; a blank line starts a paragraph.
export function parseMarkup(markup, stats) {
  const pattern = markerPattern(stats);
  const paragraphs = markup.split(/\n\s*\n/).map((raw) => {
    const source = raw.split('\n').map((line) => line.trim()).join('\n').trim();
    if (!pattern) return { text: source.replace(/\n/g, ' '), spans: [] };

    const markers = [...source.matchAll(pattern)].map((m) => {
      const at = m.index + m[1].length;
      return { at, colon: m.index + m[0].length - m[4].length, after: m.index + m[0].length, match: m };
    });
    const markerColons = new Set(markers.flatMap(({ colon, match }) => (
      match[4] === '::' ? [colon, colon + 1] : [colon]
    )));

    let text = '';
    const spans = [];
    let cursor = 0;
    for (const { at, after, match } of markers) {
      if (at < cursor) continue;  // inside a phrase already taken
      const [, , codeOrName, number, colons] = match;
      text += source.slice(cursor, at);
      const [end, resume] = phraseEnd(source, after, colons === '::', (i) => markerColons.has(i));
      const phrase = source.slice(after, end);
      const op = number === undefined ? null : /^[+-]/.test(number) ? 'add' : 'set';
      spans.push({
        start: text.length,
        end: text.length + phrase.length,
        code: findStat(stats, codeOrName).code,
        op,
        value: number === undefined ? null : Number(number),
      });
      text += phrase;
      cursor = resume;
    }
    text += source.slice(cursor);
    return { text: text.replace(/\n/g, ' '), spans };
  });
  return { paragraphs };
}

// The stat changes a piece of marked-up text makes, in order.
export function markupChanges(markup, stats) {
  return parseMarkup(markup, stats).paragraphs.flatMap(({ text, spans }) => (
    spans.filter(({ op }) => op).map(({ start, end, code, op, value }) => ({
      code, op, value, phrase: text.slice(start, end),
    }))
  ));
}

// Apply one change to a stat's current value.
export function applyChange(current=0, { op, value }) {
  if (op === 'set') return value;
  if (op === 'add') return current + value;
  return current;
}
