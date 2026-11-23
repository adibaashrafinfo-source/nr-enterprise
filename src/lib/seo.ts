/** Published canonical host. Change here when the cPanel domain goes live. */
export const SITE_URL = "https://nr-enterprise.lovable.app";

export const canonicalUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;

export const pageHead = (title: string, description: string, path?: string) => ({
  meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ...(path ? [{ property: "og:url", content: canonicalUrl(path) }] : []),
  ],
  links: path ? [{ rel: "canonical", href: canonicalUrl(path) }] : [],
});

export const noIndexPageHead = (title: string, description: string) => {
  const head = pageHead(title, description);
  return { ...head, meta: [...head.meta, { name: "robots", content: "noindex" }] };
};
