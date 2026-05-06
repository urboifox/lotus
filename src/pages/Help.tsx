import HelmetTitle from "@/components/HelmetTitle";
import { helpContactData, helpData } from "@/data";
import { ChevronDown, Send } from "lucide-react";
import { useState } from "react";

const Help = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main className="overflow-x-hidden bg-[#FEF6EB]">
      <HelmetTitle
        title="Support"
        description="Contact Lotus support for help with writing, files, accounts, and billing"
      />

      <section className="pt-32 pb-14 md:pt-36 md:pb-16 bg-gradient-to-b from-[#F7D8AD] to-[#FEF6EB]">
        <div className="container grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8A5B21]">
              Support
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-bold leading-tight text-secondary">
              Need help with Lotus?
            </h1>
            <p className="mt-5 max-w-2xl text-lg md:text-xl leading-8 text-secondary/75">
              Contact our team for help with Scribe, My Files, sharing,
              account settings, or billing and we&apos;ll get back to you.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-primary/50 shadow-sm">
            <img
              src="/images/support-hatshepsut-cc0.jpg"
              alt="Mortuary Temple of Hatshepsut in Luxor"
              className="h-56 w-full object-cover md:h-72 lg:h-80"
            />
          </div>
        </div>
      </section>

      <section className="container py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="text-3xl font-bold text-secondary">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-lg leading-8 text-secondary/70">
              Quick answers for common Lotus workspace questions.
            </p>

            <div className="mt-6 space-y-3">
              {helpData.map(({ question, answer }, index) => {
                const isOpen = openIndex === index;
                return (
                  <button
                    key={question}
                    type="button"
                    className="w-full rounded-lg border border-primary/45 bg-white/55 p-4 text-left shadow-sm transition hover:bg-[#FBF2E6]"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span className="text-lg font-bold text-secondary">
                        {question}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-secondary transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                    {isOpen && (
                      <span className="mt-3 block border-t border-primary/35 pt-3 text-base leading-7 text-secondary/70">
                        {answer}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-primary/45 bg-[#FBF2E6] p-5 md:p-7 shadow-sm">
            <h2 className="text-3xl font-bold text-secondary">
              Send a message
            </h2>
            <p className="mt-2 text-base leading-7 text-secondary/70">
              Tell us what you need help with. This form keeps the existing
              frontend behavior and can be connected to a support endpoint when
              one is available.
            </p>

            <form className="mt-6 flex flex-col gap-5">
              {helpContactData.map(({ label, placeholder, type, name, Icon }) => (
                <div key={name} className="space-y-2">
                  <label
                    htmlFor={name}
                    className="block text-sm font-bold text-secondary"
                  >
                    {label}
                  </label>
                  <div className="relative">
                    <Icon
                      className={`absolute left-3 h-5 w-5 text-placeholder ${
                        type === "textarea" ? "top-4" : "top-1/2 -translate-y-1/2"
                      }`}
                    />
                    {type === "textarea" ? (
                      <textarea
                        id={name}
                        placeholder={placeholder}
                        name={name}
                        rows={6}
                        className="w-full resize-y rounded-lg border border-[#D8A86585] bg-[#FEF6EB] py-3 pl-11 pr-4 text-secondary placeholder:text-[#7A7368] focus:outline-none focus:ring-2 focus:ring-primary/55"
                      />
                    ) : (
                      <input
                        id={name}
                        type={type}
                        placeholder={placeholder}
                        name={name}
                        className="h-12 w-full rounded-lg border border-[#D8A86585] bg-[#FEF6EB] pl-11 pr-4 text-secondary placeholder:text-[#7A7368] focus:outline-none focus:ring-2 focus:ring-primary/55"
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-secondary bg-primary px-5 py-3 font-semibold text-secondary transition hover:bg-primary-light sm:w-fit"
              >
                <Send className="h-5 w-5" />
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Help;
