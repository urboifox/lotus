import Title from "../ui/Title";
import Quote from "@/assets/quote.svg?react";
import { motion } from "framer-motion";
const UserFeedbackSection = () => {
  return (
    <section className="bg-[url('/images/pyramid3.png')] bg-cover bg-no-repeat bg-[position:center_30%] py-10 pb-18 my-16">
      <Title title="Testimonials" description="Users Feedbacks" />
      <div className="container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 justify-center items-center gap-8">
        <motion.div
          className="flex flex-col items-center gap-4 p-4 text-[#514F4AC2] hover:text-secondary hover:scale-105 transition group "
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Quote className="w-10 h-10 text-[#A97C3C99] group-hover:text-primary" />
          <p className="text-xl font-medium font-playfair-display text-center">
            Bringing ancient Egyptian culture closer to everyone
          </p>
          <p className="text-xl font-normal font-playfair-display">
            Dania Ezouli
          </p>
        </motion.div>
        <motion.div
          className="flex flex-col items-center gap-4 p-4 text-[#514F4AC2] hover:text-secondary hover:scale-105 transition group "
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <Quote className="w-10 h-10 text-[#A97C3C99] group-hover:text-primary" />
          <p className="text-xl font-medium font-playfair-display text-center">
            I was amazed at how quickly I could translate symbols into English
          </p>
          <p className="text-xl font-normal font-playfair-display">
            Dania Ezouli
          </p>
        </motion.div>
        <motion.div
          className="flex flex-col items-center gap-4 p-4 text-[#514F4AC2] hover:text-secondary hover:scale-105 transition group "
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <Quote className="w-10 h-10 text-[#A97C3C99] group-hover:text-primary" />
          <p className="text-xl font-medium font-playfair-display text-center">
            I’ve received so many compliments since I started using these lenses
          </p>
          <p className="text-xl font-normal font-playfair-display">
            Dania Ezouli
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default UserFeedbackSection;
