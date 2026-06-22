// Shared helpers for opening-book serialization.
//
// The source file under `data/` is committed in pretty + sorted form
// so each entry sits on its own line. That keeps git diffs small when
// the generator turns over only a handful of moves between runs.
//
// The distributed file under `public/` is the same data minified to
// a single line — served to the AI Web Worker.

/** Sort entries by key (lexicographically) and serialize to a
 *  pretty form with each entry on its own line at one indent level. */
export function stringifyPretty(book) {
  const entries = Object.entries(book).sort(([a], [b]) => (a < b ? -1 : 1));
  let text = "{\n";
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    text += "  " + JSON.stringify(key) + ": " + JSON.stringify(value);
    if (i < entries.length - 1) text += ",";
    text += "\n";
  }
  text += "}\n";
  return text;
}

/** Single-line minified form (default JSON.stringify output). */
export function stringifyMinified(book) {
  return JSON.stringify(book);
}
