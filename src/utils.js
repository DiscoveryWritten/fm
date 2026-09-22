import { readText } from './content';

export const EQUIPMENT = {
  weapon: "Weapons",
  body: "Body armor",
  legs: "Leggings",
  feet: "Footwear",
  head: "Headgear",
  arms: "Sleeves",
  shield: "Shields",
  waist: "Waist gear",
  ring: "Rings",
};
export const EQUIPMENT_ORDER = Object.keys(EQUIPMENT);


export const STAT_NAMES = {
  A: 'Atk',
  D: 'Def',
  S: 'Spd',
}


export const RARITY_COLORS = [
  '#888',
  '#c7c7c7',
  '#8d8',
  '#ff0',
  '#f0f',
];

const KEY_ALIASES = {
  ArrowDown: '↓',
  ArrowUp: '↑',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'space',
}

export function renderTemplate (tmpl, data) {
  const keys = Object.keys(data).map((k) => k.split('{')[0]);  // avoid parameters in key names
  const values = Object.values(data);
  const func = new Function(...keys, `return \`${tmpl}\`;`);
  return func(...values);
};

export function keyAlias(key) {
  return KEY_ALIASES[key] || key;
}


export function price({ rarity=0, stats={} }) {
  const statValue = Object.values(stats || {}).reduce((a, b) => a + b, 0);
  return (rarity + 1) * (statValue + 1);
}


const MINI_NUMBERS = '₀₁₂₃₄₅₆₇₈₉⏨'
export function minifyNumbers(str) {
  return `${str}`.replace(/\d/g, (match) => MINI_NUMBERS[match]);
}

// Word-wrap `text` to `width`: lines of { word, start }, where `start` is the
// word's index in `text`.  A line holds as many words as fit with single
// spaces between them.  (A first word wider than the line leaves an empty
// line before it, which the menus have always shown.)
export function wrapWords(text, width) {
  const lines = [];
  let currentLine = [];
  let lineLength = 0;  // the line's words joined with spaces
  let start = 0;

  text.split(' ').forEach((word) => {
    if (lineLength + word.length + 1 > width) {
      lines.push(currentLine);
      currentLine = [];
      lineLength = 0;
    }
    lineLength += currentLine.length ? word.length + 1 : word.length;
    currentLine.push({ word, start });
    start += word.length + 1;
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

export function bufferize(topMargin, text, width, height, scrollOffset) {
  const scrolledBuffer = wrapWords(text, width)
    .slice(scrollOffset, scrollOffset + height - topMargin)
    .map((line) => line.map(({ word }) => word).join(' '));
  scrolledBuffer.unshift(...Array(topMargin).fill(''));
  return scrolledBuffer;
}

export function bufferizeList(topMargin, buffer, width, height, scrollOffset) {
  const scrolledBuffer = buffer
    .slice(scrollOffset, scrollOffset + height - topMargin);
  scrolledBuffer.unshift(...Array(topMargin).fill(''));
  return scrolledBuffer;
}


export async function loadSprite(kind, item, { offsetLeft=0, width, height }, ...positions) {
  const { template='none', rarity=0, name='--' } = item;
  const [[row, col], secondPosition=null] = positions;
  return await readText(`equipment/${kind}/${template}.txt`)
    .then((text) => {
      const buffer = Array.from({ length: height }, () => Array(offsetLeft + width).fill(' '));
      const [graphics, stats] = text.trim().split('---');
      const lines = graphics.split('\n');
      let icon = null;
      lines.forEach((line) => {
        let [offset, sprites=''] = line.split(':');
        offset = parseInt(offset, 10);
        if (!secondPosition || !sprites.includes(',')) {
          sprites = sprites.split('');
          sprites.forEach((char, i) => {
            buffer[row + offset][col + i + offsetLeft] = char;
          });
        } else if (sprites.includes(',')) {
          sprites = sprites.split(',', 2);
          buffer[row + offset][col + offsetLeft] = sprites[0];
          buffer[secondPosition[0] + offset][secondPosition[1] + offsetLeft] = sprites[1];
        }
        if (!icon) {
          icon = sprites.join('').trim()[0];
        }
      });
      // console.log('loadSprite', kind, template, icon);
      const data = {
        ...item, template, rarity, name, buffer, icon,
      };
      stats && stats.split('\n').forEach((line) => {
        const [stat, value] = line.split(':');
        data.stats[stat] = parseInt(value, 10);
      });
      window.dispatchEvent(new CustomEvent(`_item`, { detail: { on: item.kind, data, text } }));
      return data;
    });
}


export function groupEquipment(source, omit={}, extra={}) {
  const entries = source.split('\n').map((item) => {
    const [kind, template, rarity, name, stat, id=null] = item.split('/');
    if (omit[kind]?.find((item) => item.name === name)) {
      return null;
    }
    const statValue = parseInt(stat, 10);
    const stats = { [kind === 'weapon' ? 'A' : 'D']: statValue };
    return {
      name,
      kind,
      stats,
      price: -price({ rarity: parseInt(rarity, 10), stats }),
      item: {
        name,
        template,
        id: id !== null ? parseInt(id, 10) : null,
        rarity: parseInt(rarity, 10),
        stats,
      },
      ...extra,
    };
  }).filter(Boolean);

  // Break into groups by kind
  const groups = Object.values(entries.reduce((acc, entry) => {
    const { kind } = entry;
    if (!acc[kind]) {
      acc[kind] = { name: EQUIPMENT[kind], items: [], kind };
    }
    acc[kind].items.push(entry);
    return acc;
  }, {})).sort((a, b) => {
    return EQUIPMENT_ORDER.indexOf(a.kind) - EQUIPMENT_ORDER.indexOf(b.kind);
  });

  return groups;
}

export function parseDirectionsList(directions) {
  return directions.split(/(?<=\d)(?=[<>^v])/).map((s) => {
    const [dir, amount] = [s[0], Number(s.slice(1))];
    if (dir === '<') return [0, -amount];
    if (dir === '>') return [0, amount];
    if (dir === '^') return [-amount, 0];
    if (dir === 'v') return [amount, 0];
  });
}
