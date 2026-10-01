export function parse() {
  return {
    items: makeItems,
    text: null,
  }
}

function makeItems() {
  const slotNames = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const [name] = key.split('/', 1);
    if (name !== 'latest' && !name.startsWith('meta:') && !slotNames.includes(name)) {
      slotNames.push(name);
    }
  }
  return slotNames;
}
