import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Menu, X, Crown, User, LogOut } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background font-body">
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <span className="text-primary font-display font-bold text-sm">C</span>
              </div>
              <span className="font-display text-xl font-semibold text-foreground tracking-tight">
                Cine<span className="text-primary">Connect</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive(link.path)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <Link to="/search">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </Button>
                  </Link>
                  {!profile?.is_pro && (
                    <Link to="/pricing">
                      <Button size="sm" className="glass-gold text-primary-foreground font-semibold hover:opacity-90">
                        <Crown className="w-4 h-4 mr-1" />
                        Upgrade to PRO
                      </Button>
                    </Link>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center hover:border-primary/30 transition-colors overflow-hidden">
                        {profile?.profile_photo ? (
                          <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard" className="cursor-pointer">Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={profile ? `/profile/${profile.id}` : "/create-profile"} className="cursor-pointer">
                          {profile ? "My Profile" : "Create Profile"}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/create-profile" className="cursor-pointer">Edit Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => base44.auth.logout()} className="cursor-pointer text-destructive">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => base44.auth.redirectToLogin()}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => base44.auth.redirectToLogin()}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card border-border w-72">
                <div className="flex flex-col gap-4 mt-8">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive(link.path) ? "text-primary bg-primary/10" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-t border-border pt-4">
                    {user ? (
                      <>
                        <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-secondary rounded-lg">
                          Dashboard
                        </Link>
                        <Link to="/create-profile" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-secondary rounded-lg">
                          {profile ? "Edit Profile" : "Create Profile"}
                        </Link>
                        <button onClick={() => base44.auth.logout()} className="block w-full text-left px-4 py-3 text-sm text-destructive hover:bg-secondary rounded-lg">
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <Button className="w-full bg-primary text-primary-foreground" onClick={() => base44.auth.redirectToLogin()}>
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

      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-primary font-display font-bold text-xs">C</span>
              </div>
              <span className="font-display text-lg font-semibold text-foreground">
                Cine<span className="text-primary">Connect</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/search" className="hover:text-foreground transition-colors">Directory</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} CineConnect. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}