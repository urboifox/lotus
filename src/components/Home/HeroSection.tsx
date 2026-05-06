import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen w-full bg-[url('/images/hero-sphinx-cc0.jpg')] bg-cover bg-no-repeat bg-[position:60%_center] md:bg-[position:center_45%] flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20"></div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      <motion.div
        className="container relative z-10 pt-28 pb-16 text-white"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="max-w-3xl">
          <motion.p
            className="text-sm md:text-base font-semibold uppercase tracking-[0.18em] text-primary-light"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: "easeOut" }}
          >
            Lotus Scribe Workspace
          </motion.p>
          <motion.h1
            className="mt-4 text-4xl sm:text-5xl md:text-7xl font-bold leading-tight text-white"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          >
            Don&apos;t Just Read History. Write It.
          </motion.h1>
          <motion.p
            className="mt-6 text-lg sm:text-xl md:text-2xl leading-8 md:leading-10 font-medium text-[#FFF6E7] max-w-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
          >
            A professional workspace for composing, editing, saving, and
            collaborating on Ancient Egyptian hieroglyphic texts.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col sm:flex-row gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.45,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <button
              className="text-lg border border-primary px-6 py-3 bg-primary rounded-lg text-secondary hover:bg-primary-light transition font-semibold cursor-pointer"
              onClick={() => navigate("/writing")}
            >
              Start Writing
            </button>
            <button
              className="text-lg border border-white/45 px-6 py-3 bg-white/10 rounded-lg text-white hover:bg-white/20 transition font-semibold cursor-pointer backdrop-blur-sm"
              onClick={() => navigate("/files")}
            >
              Open My Files
            </button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
