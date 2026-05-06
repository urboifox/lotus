import HelmetTitle from "@/components/HelmetTitle";
import AboutSection from "@/components/Home/AboutSection";
import HeroSection from "@/components/Home/HeroSection";
import HowSection from "@/components/Home/HowSection";
import UserFeedbackSection from "@/components/Home/UserFeedbackSection";
import WhyChooseUsSection from "@/components/Home/WhyChooseUsSection";

const Home = () => {
  return (
    <>
      <HelmetTitle
        title="Home"
        description="Lotus is a professional workspace for writing, saving, and collaborating on Ancient Egyptian hieroglyphic texts."
      />
      <HeroSection />
      <AboutSection />
      <HowSection />
      <WhyChooseUsSection />
      <UserFeedbackSection />
    </>
  );
};

export default Home;
