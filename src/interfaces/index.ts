export interface GardnerItem {
  id: string;
  family: string;
  gardner_code: string;
  picture_URL: string;
  picture_size: number;
  gardner_details: {
    id: string;
    gardner_id: string;
    language: string;
    transliteration_latin: string;
    type: string | null;
    source_text: string | null;
    is_vertical: boolean | null;
    is_horizontal: boolean | null;
    is_circular: boolean | null;
    is_oval: boolean | null;
    translation_ar: string;
    translations: {
      id: string;
      gardner_id: string;
      gardner_detail_id: string;
      language: string;
      translation: string;
      kind: string;
    }[];
  }[];
}

export interface IRegister {
  name: "email" | "password" | "name" | "user_name";
  type: "text" | "password";
  label: string;
  placeholder: string;
}
export interface ILogin {
  name: "username" | "password";
  type: "text" | "password";
  label: string;
  placeholder: string;
}
export interface IForgotPassword {
  name: "email";
  type: "email";
  label: string;
  placeholder: string;
}
export interface IResetPassword {
  name: "email" | "otp" | "new_password" | "confirm_password";
  type: "email" | "text" | "password";
  label: string;
  placeholder: string;
}
export interface IVerifyRegistration {
  name: "email" | "verificationCode";
  type: "email" | "text";
  label: string;
  placeholder: string;
}
