import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <>
      <section className="relative h-screen w-full bg-[url('/images/notfound.jpg')] bg-[length:100%_100vh] bg-no-repeat bg-fixed flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30"></div>
        <motion.div
          className="relative z-10 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="container">
            <motion.h1
              className="text-7xl md:text-8xl font-galada text-primary-light drop-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              404
            </motion.h1>
            <motion.h1
              className="text-7xl md:text-8xl font-galada text-primary-light drop-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              Page Not Found
            </motion.h1>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            >
              <Link
                className="mt-6 inline-block text-xl px-6 py-3 bg-primary rounded-lg text-secondary hover:bg-primary-light transition font-playfair-display font-semibold cursor-pointer"
                to="/"
              >
                Go home
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </>
  );
};

export default NotFound;
