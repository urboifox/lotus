import HelmetTitle from "@/components/HelmetTitle";
import CustomSection from "@/components/ui/CustomSection";
import Title from "@/components/ui/Title";
import { motion } from "framer-motion";

const Shop = () => {
  return (
    <CustomSection className="mt-32">
      <HelmetTitle
        title="Shop"
        description="Explore our wide collection of books and find your perfect read"
      />
      <Title
        title="Featured Books"
        description="Explore our wide collection of books and find your perfect read"
      />
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {Array.from({ length: 10 }).map((_, index) => (
          <motion.div
            key={index}
            className="bg-background rounded-lg border border-[#D8A8659C] p-2"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
              ease: "easeOut",
            }}
            whileHover={{
              y: -8,
              scale: 1.03,
              boxShadow: "0 15px 35px rgba(169, 124, 60, 0.2)",
              transition: { duration: 0.3 },
            }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="w-full h-38 flex items-center justify-center bg-[#FAE5C8] rounded-lg mb-2 border border-[#D8A8659C]"
              whileHover={{
                scale: 1.05,
                backgroundColor: "rgba(250, 229, 200, 0.8)",
                transition: { duration: 0.3 },
              }}
            >
              <motion.img
                src={"/images/footerlogo.png"}
                alt="footerlogo"
                className="w-10 h-10 object-cover"
                whileHover={{
                  rotate: 360,
                  scale: 1.1,
                  transition: { duration: 0.7, ease: "easeInOut" },
                }}
              />
            </motion.div>
            <motion.div
              className="flex items-center justify-between mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.2, duration: 0.4 }}
            >
              <h2 className="text-lg font-semibold text-center font-playfair-display">
                File {index + 1}
              </h2>
              <p className="text-sm font-normal text-center font-poppins">
                {new Date().toLocaleDateString()}
              </p>
            </motion.div>
            <motion.p
              className="text-base font-normal text-left font-playfair-display mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.4 }}
            >
              Discover the fascinating world of ancient Egyptian hieroglyphs and
              their meanings in this comprehensive guide...
            </motion.p>
            <motion.div
              className="flex items-center justify-between mt-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.4, duration: 0.4 }}
            >
              <motion.button
                className="px-4 py-2 bg-[#A97C3C] text-white rounded-lg font-semibold hover:bg-[#8B6B47] transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                Add to Cart
              </motion.button>
              <motion.span
                className="text-lg font-bold text-[#A97C3C]"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                $29.99
              </motion.span>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </CustomSection>
  );
};

export default Shop;
