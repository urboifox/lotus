import { MoveUpRight } from "lucide-react";
import Title from "../ui/Title";
import CustomSection from "../ui/CustomSection";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const AboutSection = () => {
  const navigate = useNavigate();
  return (
    <CustomSection>
      <Title
        title="Don't Just Read History. Write It."
        description="Lotus is built for composing, editing, saving, and sharing hieroglyphic work."
      />
      <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
        <motion.div
          className="max-w-[750px] order-2 lg:order-1"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="text-xl lg:text-2xl leading-8 lg:leading-10 text-center lg:text-left font-normal text-secondary">
            Lotus gives students, researchers, and writing teams a focused place
            to prepare hieroglyphic texts. Compose with Scribe, refine passages,
            save project files, and share work for collaborative review without
            reducing the platform to a single translation action.
          </p>
          <motion.button
            className="flex items-center gap-2 mt-8 text-xl border border-secondary px-6 py-3 bg-primary rounded-lg text-secondary hover:bg-primary-light transition font-semibold cursor-pointer"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              delay: 0.1,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            onClick={() => navigate("/writing")}
          >
            Start Writing <MoveUpRight className="w-5 h-5 font-bold" />
          </motion.button>
        </motion.div>
        <motion.div
          className="order-1 lg:order-2 relative overflow-visible before:content-[''] before:absolute before:inset-0 before:-translate-x-5 before:translate-y-5 before:bg-primary before:rounded-lg before:-z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <img
            src="/images/pyramid.png"
            alt="Egyptian pyramid"
            className="relative z-10 object-cover h-[320px] md:h-[420px] rounded-lg border border-primary/40"
          />
        </motion.div>
      </div>
    </CustomSection>
  );
};

export default AboutSection;
