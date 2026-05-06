import HelmetTitle from "@/components/HelmetTitle";
import MainContent from "@/components/writing/content/MainContent";
import { useParams } from "react-router-dom";

const SharedFile = () => {
  const { shareToken = "" } = useParams<{ shareToken: string }>();

  return (
    <>
      <HelmetTitle
        title="Shared File"
        description="Open and edit a shared Lotus file"
      />
      <MainContent shareToken={shareToken} />
    </>
  );
};

export default SharedFile;
