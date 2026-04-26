import { useEffect } from "react";

/**
 * Lightweight client-side OG/meta tag manager. Sets/cleans up:
 *   - document.title
 *   - <meta property="og:title|og:description|og:image|og:url|og:type">
 *   - <meta name="twitter:card|twitter:title|twitter:description|twitter:image">
 *
 * Modern crawlers (Twitter, Slack, Discord, iMessage, LinkedIn) render JS,
 * so dynamic tags do work for share previews. Facebook caches aggressively;
 * server-side rendering is still ideal for FB, but this is a strong default.
 */
export function usePageMeta({ title, description, image, url, type = "website" }) {
  useEffect(() => {
    if (!title && !description && !image) return;

    const previousTitle = document.title;
    if (title) document.title = title;

    const setMeta = (selector, attr, name, value) => {
      if (value == null) return;
      let el = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
      return el;
    };

    const tags = [
      setMeta("og:title", "property", "og:title", title),
      setMeta("og:description", "property", "og:description", description),
      setMeta("og:image", "property", "og:image", image),
      setMeta("og:url", "property", "og:url", url),
      setMeta("og:type", "property", "og:type", type),
      setMeta("twitter:card", "name", "twitter:card", image ? "summary_large_image" : "summary"),
      setMeta("twitter:title", "name", "twitter:title", title),
      setMeta("twitter:description", "name", "twitter:description", description),
      setMeta("twitter:image", "name", "twitter:image", image),
    ];

    return () => {
      document.title = previousTitle;
      // We leave the tag elements in place but clear their content; cheaper
      // than removing/recreating on every navigation.
      tags.forEach((el) => el && el.removeAttribute("content"));
    };
  }, [title, description, image, url, type]);
}
