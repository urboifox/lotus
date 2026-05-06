import { accessLinks, navLinks, socialLinks } from "@/data";
import { Menu, X, User, LogOut, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/services/profile";
import { clearStoredAuth, notifyAuthChanged, useStoredAuth } from "@/utils/authSession";
import type { UserProfile } from "@/types/profile";

interface UserData {
  access_token?: string;
  email?: string;
  roles?: string[];
  name?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  user_name?: string;
  profile_picture?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  avatar_updated_at?: number;
}

const formatName = (value?: string | null) => {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getDisplayName = (user: UserData | null) => {
  if (!user) return "";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const preferredName =
    fullName || user.display_name || user.name || user.user_name;
  if (preferredName) return formatName(preferredName);
  if (user.email) return formatName(user.email.split("@")[0]);
  return "Account";
};

const getAvatarUrl = (user: UserData | null) =>
  user?.profile_picture || user?.avatar_url || user?.avatar || "";

const resolveAvatarUrl = (url: string) => {
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url;
  try {
    return new URL(url, import.meta.env.VITE_API_URL).toString();
  } catch {
    return url;
  }
};

const withCacheKey = (url: string, cacheKey?: number) => {
  if (!url || !cacheKey || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${cacheKey}`;
};

const compactProfile = (profile: UserProfile) =>
  Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  ) as Partial<UserData>;

const mergeProfileIntoStoredUser = (profile: UserProfile) => {
  const rawUser = localStorage.getItem("user");
  if (!rawUser) return;

  try {
    const user = JSON.parse(rawUser) as Record<string, unknown>;
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...user,
        email: profile.email ?? user.email,
        name: profile.name ?? user.name,
        first_name: profile.first_name ?? user.first_name,
        last_name: profile.last_name ?? user.last_name,
        display_name: profile.display_name ?? user.display_name,
        user_name: profile.user_name ?? user.user_name,
        profile_picture: profile.profile_picture ?? user.profile_picture,
        avatar_url: profile.avatar_url ?? user.avatar_url,
        avatar: profile.avatar ?? user.avatar,
        avatar_updated_at: user.avatar_updated_at,
        roles: profile.roles ?? user.roles,
      }),
    );
    notifyAuthChanged();
  } catch {
    // Keep the navbar resilient if an older cached auth payload is malformed.
  }
};

const NavbarAvatar = ({
  avatarUrl,
  sizeClass,
  iconClass,
}: {
  avatarUrl: string;
  sizeClass: string;
  iconClass: string;
}) => {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  const canShowImage = Boolean(avatarUrl && !hasImageError);

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/30 border border-primary/60`}
    >
      {canShowImage ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <User className={iconClass} />
      )}
    </span>
  );
};

const isActivePath = (path: string, pathname: string) =>
  path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const lockedScrollYRef = useRef(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useStoredAuth() as {
    isAuthenticated: boolean;
    user: UserData | null;
  };

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  useEffect(() => {
    if (profile) {
      mergeProfileIntoStoredUser(profile);
    }
  }, [profile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    setIsProfileDropdownOpen(false);
    navigate("/");
  };
  useEffect(() => {
    const handleScroll = () => {
      if (isMobileMenuOpen) {
        // Keep header visible while menu is open and ignore scroll updates
        setIsHidden(false);
        return;
      }
      const currentY = window.scrollY;
      const wasY = lastScrollYRef.current;

      setIsScrolled(currentY > 0);

      // Show when near top
      if (currentY < 10) {
        setIsHidden(false);
      } else {
        const isScrollingDown = currentY > wasY;
        if (isScrollingDown && currentY > 80) {
          setIsHidden(true);
        } else if (!isScrollingDown) {
          setIsHidden(false);
        }
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileMenuOpen]);

  // Lock background scrolling when mobile menu is open
  useEffect(() => {
    const body = document.body as HTMLBodyElement;
    if (isMobileMenuOpen) {
      lockedScrollYRef.current = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollYRef.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.overflow = "hidden";
      body.style.width = "100%";
    } else {
      const y = lockedScrollYRef.current;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.overflow = "";
      body.style.width = "";
      if (y) {
        window.scrollTo(0, y);
      }
    }
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const profileUser = profile
    ? ({ ...user, ...compactProfile(profile) } as UserData)
    : user;
  const displayName = getDisplayName(profileUser);
  const avatarUrl = withCacheKey(
    resolveAvatarUrl(getAvatarUrl(profileUser)),
    profileUser?.avatar_updated_at,
  );

  return (
    <>
      <header
        className={`container fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div
          className={`flex justify-between items-center container h-18 md:h-20 mt-4 md:mt-6
${
  isScrolled ? "bg-[#F7D8AD]" : "bg-[#F7D8AD]/90"
} rounded-lg border border-primary/70 shadow-sm backdrop-blur`}
        >
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src={"/images/footerlogo.png"}
              alt="Lotus"
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
            />
            <span className="text-2xl md:text-3xl font-bold text-[#2D2216] leading-none">
              Lotus
            </span>
          </Link>
          <nav className="hidden md:block">
            <ul className="flex items-center gap-5 lg:gap-7 xl:gap-9">
              {navLinks.map(({ name, path }) => {
                if (
                  path === "/auth/login" &&
                  localStorage.getItem("user") !== null
                ) {
                  return null;
                }
                if (name === "Saved" && localStorage.getItem("user") === null) {
                  return null;
                }
                return (
                  <li
                    key={name}
                    className={`text-secondary text-base lg:text-lg
                    transition cursor-pointer
                    ${isActivePath(path, pathname) ? "font-bold" : "font-medium "}
                    `}
                  >
                    <Link
                      to={path}
                      className="rounded-md px-1 py-2 hover:text-[#6F4B1F]"
                    >
                      {name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="hidden xl:flex items-center gap-4">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() =>
                    setIsProfileDropdownOpen(!isProfileDropdownOpen)
                  }
                  className="flex items-center gap-2 max-w-[230px] px-3 py-2 rounded-lg bg-[#FEF6EB]/55 hover:bg-primary/35 transition-colors cursor-pointer border border-primary/35"
                >
                  <NavbarAvatar
                    avatarUrl={avatarUrl}
                    sizeClass="h-8 w-8"
                    iconClass="w-4 h-4 text-secondary/70"
                  />
                  <span className="truncate text-sm font-semibold text-secondary">
                    {displayName}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-secondary transition-transform duration-200 ${
                      isProfileDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-4 w-56 bg-[#F7D8AD] rounded-lg border border-primary shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-primary/50">
                      <p className="truncate text-sm font-bold text-secondary">
                        {displayName}
                      </p>
                      {profileUser?.email && (
                        <p className="truncate text-xs text-secondary/65">
                          {profileUser.email}
                        </p>
                      )}
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-secondary hover:bg-primary/30 transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <span>Profile</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-3 w-full text-secondary hover:bg-primary/30 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              accessLinks.map(({ name, path, Icon }) => (
                <Link to={path} key={name}>
                  <Icon className="w-7 h-7" />
                </Link>
              ))
            )}
          </div>
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 text-secondary hover:scale-105 transition-colors cursor-pointer"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      {/* Mobile Navigation */}
      <div
        className={`px-[2rem] pt-8 fixed inset-0 z-40 bg-[#F7D8AD] transition-transform duration-300 md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-24 px-8">
          <nav className="flex-1">
            <ul className="flex flex-col gap-8">
              {navLinks.map(({ name, path }) => (
                <li key={name}>
                  <Link
                    to={path}
                    onClick={toggleMobileMenu}
                    className={`text-secondary hover:text-[#6F4B1F] text-2xl 
                      transition cursor-pointer block py-2
                      ${isActivePath(path, pathname) ? "font-bold" : "font-medium "}
                      `}
                  >
                    {name}
                  </Link>
                </li>
              ))}
              {/* Mobile Auth Links */}
              {user ? (
                <>
                  <li>
                    <Link
                      to="/profile"
                      onClick={toggleMobileMenu}
                      className="flex items-center gap-3 text-secondary hover:scale-105 text-2xl 
                        transition cursor-pointer py-2"
                    >
                      <NavbarAvatar
                        avatarUrl={avatarUrl}
                        sizeClass="h-9 w-9"
                        iconClass="w-5 h-5"
                      />
                      <span className="truncate">{displayName}</span>
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        handleLogout();
                        toggleMobileMenu();
                      }}
                      className="flex items-center gap-3 text-secondary hover:scale-105 text-2xl 
                        transition cursor-pointer py-2"
                    >
                      <LogOut className="w-6 h-6" />
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                accessLinks.map(({ name, path, Icon }) => (
                  <li key={name}>
                    <Link
                      to={path}
                      onClick={toggleMobileMenu}
                      className="flex items-center gap-3 text-secondary hover:scale-105 text-2xl 
                        transition cursor-pointer capitalize py-2"
                    >
                      <Icon className="w-6 h-6" />
                      {name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </nav>
          <div className="flex justify-center items-center gap-6 pb-8">
            {socialLinks.map(({ name, icon: Icon }) => (
              <a href="#" key={name} className="cursor-pointer">
                <Icon className="w-10 h-10" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
