// The game's text files, loaded once for the checks.  `read` is how to get
// one file's text: from disk under Vitest, over fetch in the browser.

export async function loadContent(files, read) {
  const texts = await Promise.all(files.map(read));
  return {
    files,
    text: Object.fromEntries(files.map((file, i) => [file, texts[i]])),
    exists: (file) => files.includes(file),
    list: (dir) => files.filter((f) => f.startsWith(`${dir}/`)).map((f) => f.slice(dir.length + 1)),
  };
}
