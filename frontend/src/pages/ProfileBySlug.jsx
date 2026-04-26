import { useParams } from "react-router-dom";
import ProfilePage from "./ProfilePage";

// This page handles /u/[slug] routes by rendering ProfilePage
// ProfilePage already reads from window.location.pathname and
// filters by profile_slug — we just need the routing to land here.
// We override the pathname segment so ProfilePage can read it.

export default function ProfileBySlug() {
  const { slug } = useParams();

  // Temporarily patch window.location for ProfilePage to read
  // (ProfilePage uses window.location.pathname.split("/profile/")[1])
  // Instead we render a slim wrapper that sets the right URL context.
  // Since ProfilePage reads from pathname, we redirect internally.
  const origPathname = window.location.pathname;

  // Reuse ProfilePage by making it think it's on /profile/[slug]
  // We monkey-patch history state so ProfilePage reads the right slug
  if (!window.location.pathname.startsWith("/profile/")) {
    window.history.replaceState({}, "", `/profile/${slug}`);
  }

  return <ProfilePage />;
}