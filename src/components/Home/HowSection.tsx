import Title from "../ui/Title";
import Recycle from "@/assets/recycle.svg?react";
import Book from "@/assets/book.svg?react";
import Search from "@/assets/search.svg?react";
import { motion } from "framer-motion";
const HowSection = () => {
  return (
    <section className="bg-[url('/images/pyramid2.png')] bg-cover bg-no-repeat bg-[position:center_30%] py-18 my-8">
      <Title
        title="Workspace Flow"
        description="From first glyph to saved project, Lotus keeps your work organized."
      />
      <div className="container grid grid-cols-[auto] md:grid-cols-[auto_auto_auto] lg:grid-cols-[auto_auto_auto_auto] justify-center items-center gap-8">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="w-48 h-48 md:w-56 md:h-56 xl:w-64 xl:h-64 flex items-center justify-center rounded-full bg-[#F9E3C6] border-[3px] border-primary">
            <Search className="w-1/2 h-1/2" />
          </div>
          <p className="text-2xl font-semibold font-playfair-display text-secondary">
            Compose in Scribe
          </p>
        </motion.div>
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <img
            src="/images/arrow.png"
            alt="arrow"
            className="rotate-90 md:rotate-0 my-16 lg:my-0 w-32 xl:w-48"
          />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <div className="w-48 h-48 md:w-56 md:h-56 xl:w-64 xl:h-64 flex items-center justify-center rounded-full bg-[#F9E3C6] border-[3px] border-primary">
            <Recycle className="w-1/2 h-1/2" />
          </div>
          <p className="text-2xl font-semibold font-playfair-display text-secondary">
            Save Your Project
          </p>
        </motion.div>

        <div className=" flex flex-col lg:flex-row items-center justify-center gap-4  md:col-start-3 lg:col-start-4 ">
          <motion.img
            src="/images/arrow.png"
            alt="arrow"
            className="rotate-90 lg:rotate-0 my-16 lg:my-0 w-32 xl:w-48 "
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          >
            <div className="w-48 h-48 md:w-56 md:h-56 xl:w-64 xl:h-64 flex items-center justify-center rounded-full bg-[#F9E3C6] border-[3px] border-primary">
              <Book className="w-1/2 h-1/2" />
            </div>
            <p className="text-2xl font-semibold font-playfair-display text-secondary">
              Share and Collaborate
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HowSection;
