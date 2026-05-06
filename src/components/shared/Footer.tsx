import { footerLinks, socialLinks } from "@/data";
import { Send } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Footer = () => {
  const { pathname } = useLocation();
  return (
    <footer className="bg-footer rounded-t-3xl relative mt-16 pt-12">
      <div className="container py-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
        <div>
          <div className="flex items-center justify-start gap-2">
            <img
              src={"/images/footerlogo.png"}
              alt="logo"
              className="w-14 h-14 object-contain"
            />
            <p className="text-4xl font-bold text-secondary">Lotus</p>
          </div>
          <p className="max-w-xl text-lg font-medium text-secondary">
            A professional workspace for writing, saving, and collaborating on
            hieroglyphic texts.
          </p>
          <div className="flex items-center gap-2 my-2">
            {socialLinks.map(({ name, icon: Icon }) => (
              <a href="#" key={name}>
                <Icon className="w-8 h-8" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-secondary mb-2">More Links</h2>
          <ul className="flex flex-col gap-2">
            {footerLinks
              .filter(({ path }) => path !== pathname)
              .map(({ name, path }) => (
                <li key={name}>
                  <Link
                    to={path}
                    className="text-lg font-medium text-secondary hover:text-[#3A2814]"
                  >
                    {name}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </div>
      <div className="absolute -top-8 left-0 right-0">
        <div className="relative flex items-center justify-center w-[88%] md:w-[50%] max-w-2xl mx-auto">
          <input
            type="text"
            placeholder="Enter your email"
            className="w-full h-16 pl-5 pr-32 sm:pr-40 rounded-full border border-[#D8A86585] outline-8 outline-[#DFC9AA] bg-[#FEF6EB] text-[#514F4A]"
          />
          <button className="absolute flex items-center justify-center right-1 h-14 cursor-pointer font-semibold bg-footer text-secondary px-3 sm:px-4 py-2 rounded-full">
            <Send className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Subscribe</span>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
