import { useEffect, useRef, useState } from "react";
import { User, Camera, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadAvatar, updateProfile } from "@/services/profile";
import type { UserProfile } from "@/types/profile";
import { notifyAuthChanged } from "@/utils/authSession";

interface ProfileSectionProps {
  profile: UserProfile;
  onUpdated: (profile?: UserProfile) => void;
}

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const withAvatarCacheBust = (url: string) => {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
};

export default function ProfileSection({ profile, onUpdated }: ProfileSectionProps) {
  const [name, setName] = useState(profile.name ?? "");
  const [userName, setUserName] = useState(profile.user_name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.profile_picture ?? null,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setName(profile.name ?? "");
    setUserName(profile.user_name ?? "");
    if (!avatarFile) {
      setAvatarPreview(profile.profile_picture ?? null);
    }
  }, [avatarFile, profile.name, profile.profile_picture, profile.user_name]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const setPreviewUrl = (url: string | null) => {
    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setAvatarPreview(url);
  };

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Name cannot be empty.";
    if (trimmed.length > 80) return "Name must be 80 characters or fewer.";
    if (!/\p{L}/u.test(trimmed)) return "Name must include at least one letter.";
    if (!/^[\p{L}\p{M} .'-]+$/u.test(trimmed)) {
      return "Name can only contain letters, spaces, hyphens, apostrophes, and periods.";
    }
    return null;
  };

  const validateUserName = (value: string): string | null => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "Username cannot be empty.";
    if (trimmed.length < 3) return "Username must be at least 3 characters.";
    if (trimmed.length > 32) return "Username must be 32 characters or fewer.";
    if (!/^[a-z0-9._-]+$/.test(trimmed)) {
      return "Username can only contain letters, numbers, dots, underscores, and hyphens.";
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, or WEBP images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be under 5 MB.");
      e.target.value = "";
      return;
    }

    setError("");
    setSuccess("");
    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  };

  const updateStoredUser = (updates: Partial<UserProfile>) => {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return;

    try {
      const user = JSON.parse(rawUser) as Record<string, unknown>;
      const hasAvatarUpdate =
        Object.prototype.hasOwnProperty.call(updates, "profile_picture") ||
        Object.prototype.hasOwnProperty.call(updates, "avatar_url") ||
        Object.prototype.hasOwnProperty.call(updates, "avatar");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.first_name ? { first_name: updates.first_name } : {}),
          ...(updates.last_name ? { last_name: updates.last_name } : {}),
          ...(updates.display_name ? { display_name: updates.display_name } : {}),
          ...(updates.email ? { email: updates.email } : {}),
          ...(updates.user_name ? { user_name: updates.user_name } : {}),
          ...(Object.prototype.hasOwnProperty.call(updates, "profile_picture")
            ? { profile_picture: updates.profile_picture }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(updates, "avatar_url")
            ? { avatar_url: updates.avatar_url }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(updates, "avatar")
            ? { avatar: updates.avatar }
            : {}),
          ...(hasAvatarUpdate ? { avatar_updated_at: Date.now() } : {}),
        }),
      );
      notifyAuthChanged();
    } catch {
      // Ignore malformed cached user data; the profile query is the source of truth.
    }
  };

  const handleSave = async () => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    const userNameError = validateUserName(userName);
    if (userNameError) {
      setError(userNameError);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let updatedProfile: UserProfile | undefined;

      // Upload avatar if changed
      if (avatarFile) {
        const avatarResponse = await uploadAvatar(avatarFile);
        updatedProfile = avatarResponse.profile;
        setPreviewUrl(withAvatarCacheBust(avatarResponse.avatar_url));
        updateStoredUser({
          ...avatarResponse.profile,
          profile_picture:
            avatarResponse.profile.profile_picture ?? avatarResponse.avatar_url,
          avatar_url: avatarResponse.avatar_url,
        });
      }

      const nextUserName = userName.trim().toLowerCase();
      const profilePayload: { name?: string; user_name?: string } = {};
      if (name.trim() !== profile.name) {
        profilePayload.name = name.trim();
      }
      if (nextUserName !== profile.user_name) {
        profilePayload.user_name = nextUserName;
      }

      if (Object.keys(profilePayload).length > 0) {
        await updateProfile(profilePayload);
        updateStoredUser(profilePayload);
        updatedProfile = updatedProfile
          ? { ...updatedProfile, ...profilePayload }
          : undefined;
      }

      setSuccess("Profile updated!");
      setAvatarFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onUpdated(updatedProfile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <div className="w-28 h-28 rounded-full overflow-hidden bg-primary/20 border-4 border-primary flex items-center justify-center">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-14 h-14 text-secondary/50" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            {saving ? (
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white" />
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={saving}
        />
        <p className="text-xs text-secondary/60 font-poppins">
          Click the avatar to change it · JPG, PNG, WEBP · max 5 MB
        </p>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-sm font-poppins text-secondary/70">Display name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-poppins text-secondary/70">Username</label>
        <Input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="username"
        />
      </div>

      {error && <p className="text-sm text-red-700 font-poppins">{error}</p>}
      {success && <p className="text-sm text-green-700 font-poppins">{success}</p>}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Save changes
      </Button>
    </div>
  );
}
