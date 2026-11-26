/** Published canonical host. Change here when the cPanel domain goes live. */
export const SITE_URL = "https://nr-enterprise.lovable.app";

export const OG_IMAGE = "/assets/brand/og-banner.png";
export const ogImageUrl = () => `${SITE_URL}${OG_IMAGE}`;

export const canonicalUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;

export const pageHead = (title: string, description: string, path?: string) => ({
  meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { property: "og:site_name", content: "NR Enterprise" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: ogImageUrl() }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }, { property: "og:image:alt", content: "NR Enterprise — All Kinds of Garments Accessories" }, { name: "twitter:image", content: ogImageUrl() },
    ...(path ? [{ property: "og:url", content: canonicalUrl(path) }] : []),
  ],
  links: path ? [{ rel: "canonical", href: canonicalUrl(path) }] : [],
});

export const noIndexPageHead = (title: string, description: string) => {
  const head = pageHead(title, description);
  return { ...head, meta: [...head.meta, { name: "robots", content: "noindex" }] };
};
