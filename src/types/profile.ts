export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  user_name?: string | null;
  profile_picture?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  roles?: string[];
}
