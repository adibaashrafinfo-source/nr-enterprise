// Social crawlers do not run JS: write the OG/Twitter image tags straight into the static index.html.
// Usage: OG_SITE_URL=https://yourdomain.com node scripts/inject-og.mjs   (default = SITE_URL from src/lib/seo.ts)
import { readFileSync, writeFileSync } from "node:fs";
const seo = readFileSync("src/lib/seo.ts", "utf8");
const site = (process.env.OG_SITE_URL || /SITE_URL = "([^"]+)"/.exec(seo)?.[1] || "").replace(/\/$/, "");
const file = "dist/client/index.html";
let html = readFileSync(file, "utf8");
const title = "NR Enterprise — All Kinds of Garments Accessories";
const desc = "Labels, tags, stickers and trims for garment factories, buying houses and brands. Woven labels, hangtags, thread, elastic, drawcords and buttons from Dhaka.";
const tags = [
  ["property", "og:title", title], ["property", "og:description", desc], ["property", "og:site_name", "NR Enterprise"], ["property", "og:url", `${site}/`],
  ["property", "og:image", `${site}/assets/brand/og-banner.png`], ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
  ["property", "og:image:alt", title], ["name", "twitter:image", `${site}/assets/brand/og-banner.png`], ["name", "twitter:title", title], ["name", "twitter:description", desc],
];
html = html.replace(/<meta property="og:(title|description)"[^>]*\/?>/g, "");
const block = tags.map(([k, n, c]) => `<meta ${k}="${n}" content="${c.replace(/"/g, "&quot;")}"/>`).join("");
html = html.replace('<meta property="og:type"', block + '<meta property="og:type"');
writeFileSync(file, html);
console.log("og tags injected for", site);
