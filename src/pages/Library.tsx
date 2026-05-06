import HelmetTitle from "@/components/HelmetTitle";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const Library = () => {
  return (
    <main className="min-h-screen bg-background pt-32 pb-20">
      <HelmetTitle
        title="Library"
        description="Lotus glyph resources and reference materials"
      />
      <section className="container">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Lotus Library
          </p>
          <h1 className="mt-4 text-4xl md:text-6xl font-bold text-secondary">
            Glyph references for careful hieroglyphic work.
          </h1>
          <p className="mt-5 text-lg md:text-xl leading-8 text-secondary/75">
            A curated reference space for signs, writing conventions, and project
            resources is being prepared. For now, continue composing in Scribe or
            return to your saved files.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/writing"
              className="inline-flex items-center justify-center rounded-lg border border-secondary bg-primary px-5 py-3 font-semibold text-secondary transition hover:bg-primary-light"
            >
              Open Scribe
            </Link>
            <Link
              to="/files"
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-[#FEF6EB] px-5 py-3 font-semibold text-secondary transition hover:bg-primary/20"
            >
              My Files
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Sign Lists",
              text: "Organized glyph references for writing and comparison.",
              Icon: Search,
            },
            {
              title: "Project Notes",
              text: "Reusable notes for translation and editorial decisions.",
              Icon: BookOpen,
            },
            {
              title: "Writing Aids",
              text: "Resources that support composition, review, and sharing.",
              Icon: Sparkles,
            },
          ].map(({ title, text, Icon }) => (
            <article
              key={title}
              className="rounded-lg border border-primary/45 bg-[#FEF6EB] p-6 shadow-sm"
            >
              <Icon className="h-7 w-7 text-primary" />
              <h2 className="mt-5 text-2xl font-bold text-secondary">{title}</h2>
              <p className="mt-3 text-base leading-7 text-secondary/70">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Library;
