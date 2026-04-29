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

    // Crawlers (Twitter, Slack, FB, LinkedIn, iMessage) ignore relative paths
    // for og:image / twitter:image — they MUST be absolute URLs. Resolve any
    // /api/... or /static/... value against window.location.origin (which on
    // production is https://getspotd.app).
    const toAbsolute = (v) => {
      if (!v || typeof v !== "string") return v;
      if (/^https?:\/\//i.test(v)) return v;
      const origin = (typeof window !== "undefined" && window.location?.origin) || "https://getspotd.app";
      return v.startsWith("/") ? origin + v : `${origin}/${v}`;
    };
    const absImage = toAbsolute(image);
    const absUrl = toAbsolute(url);

    const tags = [
      setMeta("og:title", "property", "og:title", title),
      setMeta("og:description", "property", "og:description", description),
      setMeta("og:image", "property", "og:image", absImage),
      setMeta("og:url", "property", "og:url", absUrl),
      setMeta("og:type", "property", "og:type", type),
      setMeta("twitter:card", "name", "twitter:card", absImage ? "summary_large_image" : "summary"),
      setMeta("twitter:title", "name", "twitter:title", title),
      setMeta("twitter:description", "name", "twitter:description", description),
      setMeta("twitter:image", "name", "twitter:image", absImage),
    ];

    return () => {
      document.title = previousTitle;
      // We leave the tag elements in place but clear their content; cheaper
      // than removing/recreating on every navigation.
      tags.forEach((el) => el && el.removeAttribute("content"));
    };
  }, [title, description, image, url, type]);
}
