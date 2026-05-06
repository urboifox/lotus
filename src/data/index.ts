import FacebookIcon from "@/assets/facebook.svg?react";
import TictokIcon from "@/assets/tictok.svg?react";
import InstagramIcon from "@/assets/instagram.svg?react";

import Values from "@/assets/values.svg?react";
import Vision from "@/assets/vision.svg?react";
import Mission from "@/assets/mission.svg?react";
import {
  FileText,
  LogInIcon,
  MailIcon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import type {
  IRegister,
  ILogin,
  IForgotPassword,
  IResetPassword,
  IVerifyRegistration,
} from "@/interfaces";

export const navLinks = [
  {
    name: "Home",
    path: "/",
  },
  {
    name: "Scribe",
    path: "/writing",
  },
  {
    name: "My Files",
    path: "/files",
  },
  {
    name: "Library",
    path: "/library",
  },
];

export const footerLinks = [
  {
    name: "Home",
    path: "/",
  },
  {
    name: "Scribe",
    path: "/writing",
  },
  {
    name: "My Files",
    path: "/files",
  },
  {
    name: "Library",
    path: "/library",
  },
  {
    name: "About",
    path: "/about",
  },
  {
    name: "Support",
    path: "/help",
  },
];

export const socialLinks = [
  {
    name: "facebook icon",
    icon: FacebookIcon,
    path: "/assets/facebook.svg",
  },
  {
    name: "tictok icon",
    icon: TictokIcon,
    path: "/assets/tictok.svg",
  },
  {
    name: "instagram icon",
    icon: InstagramIcon,
    path: "/assets/instagram.svg",
  },
];
export const accessLinks = [
  {
    name: "login",
    path: "/auth/login",
    Icon: LogInIcon,
  },
  {
    name: "register",
    path: "/auth/register",
    Icon: UserPlusIcon,
  },
];

//about us page
export const aboutUsData = [
  {
    title: "Our Mission",
    description:
      "Make Ancient Egyptian writing more accessible through a professional web platform for students, researchers, and heritage enthusiasts.",
    Icon: Mission,
  },
  {
    title: "Our Vision",
    description:
      "Become the leading digital workspace for hieroglyphic composition, study, saved projects, and collaborative translation work.",
    Icon: Vision,
  },
  {
    title: "Our Values",
    description:
      "Accuracy, accessibility, collaboration, and respect for cultural heritage guide the way Lotus is designed.",
    Icon: Values,
  },
];

//help page
export const helpData = [
  {
    question: "How do I start writing in Scribe?",
    answer:
      "Open Scribe from the navigation, compose your hieroglyphic text, and save the document to keep working later.",
  },
  {
    question: "Can I save and share projects?",
    answer:
      "Yes. Lotus supports saved files and sharing workflows so writing and translation projects can be reviewed collaboratively.",
  },
  {
    question: "Are there free and paid versions",
    answer:
      "Yes. Account and subscription options are managed from your profile and billing settings.",
  },
];

export const helpContactData = [
  {
    label: "Full Name",
    placeholder: "Enter your full name",
    type: "text",
    name: "name",
    Icon: UserIcon,
  },
  {
    label: "Email",
    placeholder: "Enter your email",
    type: "email",
    name: "email",
    Icon: MailIcon,
  },
  {
    label: "Message",
    placeholder: "Enter your message",
    type: "textarea",
    name: "message",
    Icon: FileText,
  },
];

export const fontFamilies = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Menlo, monospace", label: "Menlo" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "system-ui, sans-serif", label: "System UI" },
  { value: "Segoe UI, sans-serif", label: "Segoe UI" },
  { value: "Roboto, sans-serif", label: "Roboto" },
  { value: "Monaco, monospace", label: "Monaco" },
];

export const registerData: IRegister[] = [
  {
    name: "name",
    type: "text",
    label: "Full Name",
    placeholder: "Enter your full name",
  },
  {
    name: "email",
    type: "text",
    label: "Email",
    placeholder: "Enter your email address",
  },
  {
    name: "user_name",
    type: "text",
    label: "Username",
    placeholder: "Choose a username",
  },
  {
    name: "password",
    type: "password",
    label: "Password",
    placeholder: "Create a password",
  },
];

export const loginData: ILogin[] = [
  {
    name: "username",
    type: "text",
    label: "Username",
    placeholder: "Enter your username",
  },
  {
    name: "password",
    type: "password",
    label: "Password",
    placeholder: "Enter your password",
  },
];

export const forgotPasswordData: IForgotPassword[] = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "Enter your email address",
  },
];

export const resetPasswordData: IResetPassword[] = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "Enter your email address",
  },
  {
    name: "otp",
    type: "text",
    label: "OTP Code",
    placeholder: "Enter 6-digit OTP code",
  },
  {
    name: "new_password",
    type: "password",
    label: "New Password",
    placeholder: "Enter new password",
  },
  {
    name: "confirm_password",
    type: "password",
    label: "Confirm Password",
    placeholder: "Confirm new password",
  },
];

export const verifyRegistrationData: IVerifyRegistration[] = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "Enter your email address",
  },
  {
    name: "verificationCode",
    type: "text",
    label: "Verification Code",
    placeholder: "Enter 6-digit verification code",
  },
];

export const textSizes = [12, 14, 18, 24, 30, 36, 48, 60, 72, 96];
export const IconSizes = [
  {
    label: "sm",
    value: 24,
  },
  {
    label: "md",
    value: 33,
  },
  {
    label: "lg",
    value: 39,
  },
  {
    label: "xl",
    value: 48,
  },
  {
    label: "2xl",
    value: 63,
  },
  {
    label: "3xl",
    value: 81,
  },
];
