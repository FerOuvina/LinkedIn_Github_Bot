/**
 * Renders the repo's markdown guides inside the app.
 *
 * Guides live in docs/ and are served by the setup server, so a guide's relative
 * image paths ("img/logo.jpg") have to be rewritten to /docs/img/logo.jpg —
 * otherwise they resolve against the current route and 404.
 */

const ABSOLUTE = /^(https?:|data:|blob:|\/)/i;

/** Rewrite relative src/href values to absolute /docs paths. */
export function rewriteRelativeUrls(html, base = "/docs/") {
  return html.replace(
    /\b(src|href)="([^"]+)"/gi,
    (match, attr, value) => {
      if (ABSOLUTE.test(value)) return match;
      const clean = value.replace(/^\.\//, "");
      return `${attr}="${base}${clean}"`;
    }
  );
}

/** Collect h2/h3 headings with generated ids, for a table of contents. */
export function extractHeadings(html) {
  const headings = [];
  const used = new Set();
  const withIds = html.replace(
    /<h([23])>(.*?)<\/h\1>/gi,
    (match, level, inner) => {
      const text = inner.replace(/<[^>]+>/g, "");
      const base = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

      // Duplicate ids would make the table of contents link to the wrong place.
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);

      headings.push({ level: Number(level), text, id });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    }
  );

  return { html: withIds, headings };
}

export { ABSOLUTE };
