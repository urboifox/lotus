import HelmetTitle from "@/components/HelmetTitle";
import { aboutUsData } from "@/data";
import { BookOpen, FolderOpen, Handshake, PenTool } from "lucide-react";
import { motion } from "framer-motion";

const audience = [
  "Students learning Ancient Egyptian writing",
  "Researchers preparing hieroglyphic notes and drafts",
  "Heritage professionals organizing writing and translation projects",
];

const capabilities = [
  {
    title: "Write",
    description: "Compose hieroglyphic text in a focused digital workspace.",
    Icon: PenTool,
  },
  {
    title: "Edit",
    description: "Refine passages, layouts, and project content as your work develops.",
    Icon: BookOpen,
  },
  {
    title: "Save",
    description: "Keep drafts, translations, and reference files organized in My Files.",
    Icon: FolderOpen,
  },
  {
    title: "Collaborate",
    description: "Share work for review while protecting active edits.",
    Icon: Handshake,
  },
];

const About = () => {
  return (
    <main className="overflow-x-hidden bg-[#FEF6EB]">
      <HelmetTitle
        title="About"
        description="About Lotus, a modern workspace for Ancient Egyptian hieroglyphic texts"
      />

      <section className="pt-32 pb-16 md:pt-36 md:pb-20 bg-gradient-to-b from-[#F7D8AD] to-[#FEF6EB]">
        <div className="container grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8A5B21]">
              About Lotus
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-bold leading-tight text-secondary">
              A modern workspace for Ancient Egyptian hieroglyphic texts.
            </h1>
            <p className="mt-5 max-w-3xl text-lg md:text-xl leading-8 text-secondary/75">
              Lotus helps people write, edit, save, and collaborate on
              hieroglyphic work with the structure expected from a professional
              research and productivity platform.
            </p>
          </motion.div>

          <motion.div
            className="relative overflow-hidden rounded-lg border border-primary/50 shadow-sm"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          >
            <img
              src="/images/about-abu-simbel-cc0.jpg"
              alt="Great Temple at Abu Simbel"
              className="h-64 w-full object-cover md:h-80 lg:h-96"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </motion.div>
        </div>
      </section>

      <section className="container py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary">
              Built for careful writing, not just quick translation.
            </h2>
            <p className="mt-4 text-lg leading-8 text-secondary/75">
              Our mission is to make Ancient Egyptian writing more accessible
              through a professional web platform for students, researchers,
              Egyptology learners, and heritage enthusiasts.
            </p>
            <ul className="mt-6 space-y-3">
              {audience.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-primary/40 bg-white/55 px-4 py-3 text-secondary"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {capabilities.map(({ title, description, Icon }) => (
              <article
                key={title}
                className="rounded-lg border border-primary/45 bg-[#FBF2E6] p-5 shadow-sm"
              >
                <Icon className="h-7 w-7 text-[#A97C3C]" />
                <h3 className="mt-4 text-2xl font-bold text-secondary">
                  {title}
                </h3>
                <p className="mt-2 text-base leading-7 text-secondary/70">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FBF2E6] py-12 md:py-16">
        <div className="container">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary">
              Mission, vision, and values
            </h2>
            <p className="mt-3 text-lg leading-8 text-secondary/70">
              Lotus is designed around accuracy, accessibility, collaboration,
              and respect for cultural heritage.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {aboutUsData.map(({ title, description, Icon }, index) => (
              <motion.article
                key={title}
                className="rounded-lg border border-primary/45 bg-[#FEF6EB] p-6 shadow-sm"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <Icon className="h-10 w-10" />
                <h3 className="mt-5 text-2xl font-bold text-secondary">
                  {title}
                </h3>
                <p className="mt-3 text-base leading-7 text-secondary/72">
                  {description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default About;
