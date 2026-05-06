import Title from "../ui/Title";
import Finger from "@/assets/finger.svg?react";
import Hand from "@/assets/hand.svg?react";
import World from "@/assets/world.svg?react";
import CustomSection from "../ui/CustomSection";
import { motion } from "framer-motion";

const WhyChooseUsSection = () => {
  return (
    <CustomSection className="py-10 pb-18">
      <Title
        title="Product Tools"
        description="A clean workspace for serious hieroglyphic writing and translation projects."
      />
      <div className="container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 justify-center items-center gap-8">
        <motion.div
          className="flex flex-col items-start gap-4 bg-background rounded-lg p-5 border border-primary/60 shadow-sm min-h-44"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex items-center justify-start gap-3">
            <Finger className="w-10 h-10" />
            <h3 className="text-2xl font-semibold text-secondary">
              Scribe Editor:
            </h3>
          </div>
          <p className="text-xl font-normal leading-8 text-secondary">
            Compose and edit hieroglyphic text in a dedicated writing surface.
          </p>
        </motion.div>
        <motion.div
          className="flex flex-col items-start gap-4 bg-background rounded-lg p-5 border border-primary/60 shadow-sm min-h-44"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <div className="flex items-center justify-start gap-3">
            <Hand className="w-10 h-10" />
            <h3 className="text-2xl font-semibold text-secondary">My Files:</h3>
          </div>
          <p className="text-xl font-normal leading-8 text-secondary">
            Keep saved drafts, translations, and project files in one place.
          </p>
        </motion.div>
        <motion.div
          className="flex flex-col items-start gap-4 bg-background rounded-lg p-5 border border-primary/60 shadow-sm min-h-44"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <div className="flex items-center justify-start gap-3">
            <World className="w-10 h-10" />
            <h3 className="text-2xl font-semibold text-secondary">
              Collaboration:
            </h3>
          </div>
          <p className="text-xl font-normal leading-8 text-secondary">
            Share work, review changes, and protect active edits with locks.
          </p>
        </motion.div>
      </div>
    </CustomSection>
  );
};

export default WhyChooseUsSection;
