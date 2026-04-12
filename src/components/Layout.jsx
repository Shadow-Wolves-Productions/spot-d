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
  { path: "/casting", label: "Casting Calls" },
  { path: "/pricing", label: "Pricing" },
  { path: "/contact", label: "Contact & FAQ" },
];

export default function Layout() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

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
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="fixed top-0 left-0 right-0 z-50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={`h-[3px] bg-foreground transition-opacity duration-300 ${scrolled ? "opacity-100" : "opacity-100"}`} />
        <nav className={`transition-all duration-300 ${
          scrolled
            ? "bg-background/95 backdrop-blur-sm border-b border-border shadow-sm"
            : "bg-background border-b border-border"
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 lg:h-16">
              {/* Back button on child routes (mobile) */}
              {isChildRoute && (
                <button
                  onClick={() => navigate(-1)}
                  className="md:hidden flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground select-none mr-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-7 h-7 bg-foreground flex items-center justify-center group-hover:bg-primary transition-colors">
                  <span className="text-background font-display font-bold text-sm">C</span>
                </div>
                <span className="font-display text-lg font-bold text-foreground tracking-tight">
                  Cine<span className="text-primary">Connect</span>
                </span>
              </Link>

              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-0">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-5 text-sm font-medium transition-colors border-b-2 ${
                      isActive(link.path)
                        ? "text-primary border-primary"
                        : "text-foreground/60 border-transparent hover:text-foreground hover:border-foreground/20"
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
                      <Button variant="ghost" size="sm" className="text-foreground/60 hover:text-foreground text-xs">
                        <Search className="w-3.5 h-3.5 mr-1.5" />
                        Search
                      </Button>
                    </Link>
                    {!profile?.is_pro && (
                      <Link to="/pricing">
                        <Button size="sm" className="bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 rounded-none h-8 px-4">
                          <Crown className="w-3 h-3 mr-1.5" />
                          Go PRO
                        </Button>
                      </Link>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-8 h-8 bg-secondary border border-border flex items-center justify-center hover:border-foreground/30 transition-colors overflow-hidden">
                          {profile?.profile_photo ? (
                            <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-foreground/60" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border rounded-none shadow-md">
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard" className="cursor-pointer text-sm">Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={profile ? `/profile/${profile.profile_slug || profile.id}` : "/create-profile"} className="cursor-pointer text-sm">
                            {profile ? "My Profile" : "Create Profile"}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/create-profile" className="cursor-pointer text-sm">Edit Profile</Link>
                        </DropdownMenuItem>
                        {user?.role === 'admin' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to="/admin" className="cursor-pointer text-sm text-primary font-medium flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Admin Panel
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer text-sm">
                          {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => base44.auth.logout()} className="cursor-pointer text-sm text-destructive">
                          <LogOut className="w-3.5 h-3.5 mr-2" />
                          Sign Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="text-foreground/60 hover:text-foreground text-xs"
                      onClick={() => base44.auth.redirectToLogin()}>
                      Sign In
                    </Button>
                    <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 rounded-none text-xs h-8 px-4"
                      onClick={() => base44.auth.redirectToLogin()}>
                      Get Started
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
                <SheetContent side="right" className="bg-background border-border w-72 rounded-none">
                  <div className="flex flex-col gap-0 mt-8">
                    <div className="h-[2px] bg-foreground mb-4" />
                    {NAV_LINKS.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => setMobileOpen(false)}
                        className={`px-0 py-3 text-sm font-semibold border-b border-border transition-colors ${
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
                            {profile ? "Edit Profile" : "Create Profile"}
                          </Link>
                          {user?.role === 'admin' && (
                            <Link to="/admin" onClick={() => setMobileOpen(false)} className="block text-sm font-semibold text-primary py-2 flex items-center gap-2">
                              <Shield className="w-3.5 h-3.5" /> Admin Panel
                            </Link>
                          )}
                          <button onClick={toggleTheme} className="block text-sm text-foreground py-2 text-left w-full">
                            {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                          </button>
                          <button onClick={() => base44.auth.logout()} className="block text-sm text-destructive py-2 text-left">
                            Sign Out
                          </button>
                        </>
                      ) : (
                        <Button className="w-full bg-foreground text-background rounded-none" onClick={() => base44.auth.redirectToLogin()}>
                          Sign In / Register
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

      <main className="pt-[67px] pb-16 md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileBottomTabs />

      {/* Footer — editorial */}
      <footer className="border-t border-border bg-foreground mt-16 hidden md:block" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display font-bold text-sm">C</span>
                </div>
                <span className="font-display text-lg font-bold text-background">
                  Cine<span className="text-primary">Connect</span>
                </span>
              </div>
              <p className="text-xs text-background/40">The indie film talent directory.</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-background/40">
              <Link to="/search" className="hover:text-background transition-colors">Directory</Link>
              <Link to="/casting" className="hover:text-background transition-colors">Casting</Link>
              <Link to="/pricing" className="hover:text-background transition-colors">Pricing</Link>
              <Link to="/contact" className="hover:text-background transition-colors">Contact</Link>
            </div>
            <p className="text-xs text-background/30">
              © {new Date().getFullYear()} CineConnect
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}