export const pageHead = (title: string, description: string) => ({ meta: [
  { title }, { name: "description", content: description },
  { property: "og:title", content: title }, { property: "og:description", content: description },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] });

export const noIndexPageHead = (title: string, description: string) => {
  const head = pageHead(title, description);
  return { ...head, meta: [...head.meta, { name: "robots", content: "noindex" }] };
};
