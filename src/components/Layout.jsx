import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import MobileBottomTabs from "./MobileBottomTabs";
import { useTheme } from "@/lib/useTheme";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Menu, Crown, User, LogOut, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_LINKS = [
  { path: "/search", label: "Directory" },
  { path: "/casting", label: "Casting calls" },
  { path: "/pricing", label: "Pricing" },
  { path: "/contact", label: "Contact & FAQ" },
];

// Logo component — apostrophe always in lime
function SpotdLogo({ dark = false }) {
  return (
    <span className={`font-display text-lg font-bold tracking-tight ${dark ? "text-foreground" : "text-foreground"}`}>
      Spot<span style={{ color: "#E8FF47" }}>'</span>d
    </span>
  );
}

export default function Layout() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const me = await base44.auth.me();
        setUser(me);
        const profiles = await base44.entities.Profile.filter({ user_id: me.id });
        if (profiles.length > 0) setProfile(profiles[0]);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path) => location.pathname === path;
  const isChildRoute = location.pathname !== "/";

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="fixed top-0 left-0 right-0 z-50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <nav className={`transition-all duration-300 ${
          scrolled
            ? "bg-background/95 backdrop-blur-md border-b border-border"
            : "bg-background border-b border-border"
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 lg:h-16">
              {/* Back button on child routes (mobile) */}
              {isChildRoute && (
                <button
                  onClick={() => navigate(-1)}
                  className="md:hidden flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground mr-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              {/* Logo */}
              <Link to="/" className="flex items-center gap-2">
                <SpotdLogo />
              </Link>

              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-0">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-5 text-sm font-normal transition-colors border-b-2 ${
                      isActive(link.path)
                        ? "text-foreground border-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center gap-2">
                {user ? (
                  <>
                    <Link to="/search">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs">
                        <Search className="w-3.5 h-3.5 mr-1.5" />
                        Search
                      </Button>
                    </Link>
                    {!profile?.is_pro && (
                      <Link to="/pricing">
                        <Button size="sm" className="bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 rounded-full h-8 px-4">
                          Get Spot'd PRO
                        </Button>
                      </Link>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-8 h-8 bg-secondary border border-border rounded-full flex items-center justify-center hover:border-primary/40 transition-colors overflow-hidden">
                          {profile?.profile_photo ? (
                            <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border rounded-lg shadow-xl">
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard" className="cursor-pointer text-sm">Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/analytics" className="cursor-pointer text-sm">Analytics</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={profile ? `/profile/${profile.profile_slug || profile.id}` : "/create-profile"} className="cursor-pointer text-sm">
                            {profile ? "My profile" : "Create profile"}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/create-profile" className="cursor-pointer text-sm">Edit profile</Link>
                        </DropdownMenuItem>
                        {user?.role === 'admin' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to="/admin" className="cursor-pointer text-sm text-primary font-medium flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Admin panel
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer text-sm">
                          {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => base44.auth.logout()} className="cursor-pointer text-sm text-destructive">
                          <LogOut className="w-3.5 h-3.5 mr-2" />
                          Sign out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => base44.auth.redirectToLogin()}>
                      Sign in
                    </Button>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-xs h-8 px-4 font-semibold"
                      onClick={() => base44.auth.redirectToLogin()}>
                      Get spot'd
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile Menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-card border-border w-72">
                  <div className="flex flex-col gap-0 mt-8">
                    <div className="mb-6">
                      <SpotdLogo />
                    </div>
                    {NAV_LINKS.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => setMobileOpen(false)}
                        className={`px-0 py-3 text-sm font-medium border-b border-border transition-colors ${
                          isActive(link.path) ? "text-primary" : "text-foreground hover:text-primary"
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <div className="pt-6 space-y-3">
                      {user ? (
                        <>
                          <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-foreground hover:text-primary py-2">
                            Dashboard
                          </Link>
                          <Link to="/create-profile" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-foreground hover:text-primary py-2">
                            {profile ? "Edit profile" : "Create profile"}
                          </Link>
                          {user?.role === 'admin' && (
                            <Link to="/admin" onClick={() => setMobileOpen(false)} className="block text-sm font-semibold text-primary py-2 flex items-center gap-2">
                              <Shield className="w-3.5 h-3.5" /> Admin panel
                            </Link>
                          )}
                          <button onClick={toggleTheme} className="block text-sm text-foreground py-2 text-left w-full">
                            {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
                          </button>
                          <button onClick={() => base44.auth.logout()} className="block text-sm text-destructive py-2 text-left">
                            Sign out
                          </button>
                        </>
                      ) : (
                        <Button className="w-full bg-primary text-primary-foreground rounded-full font-semibold" onClick={() => base44.auth.redirectToLogin()}>
                          Get spot'd
                        </Button>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>
      </div>

      <main className="pt-[57px] lg:pt-[65px] pb-16 md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileBottomTabs />

      {/* Footer */}
      <footer className="border-t border-border bg-background mt-16 hidden md:block" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <SpotdLogo />
              <p className="text-xs text-muted-foreground mt-2">The indie film directory.</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/search" className="hover:text-foreground transition-colors">Directory</Link>
              <Link to="/casting" className="hover:text-foreground transition-colors">Casting</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <p className="text-xs text-muted-foreground/50">
              © {new Date().getFullYear()} Spot'd
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}