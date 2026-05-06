import HelmetTitle from "@/components/HelmetTitle";
import MainContent from "@/components/writing/content/MainContent";
import { useParams } from "react-router-dom";

const SharedDocument = () => {
  const { documentId = "" } = useParams<{ documentId: string }>();

  return (
    <>
      <HelmetTitle
        title="Shared File"
        description="Open and edit a shared Lotus file"
      />
      <MainContent sharedDocumentId={documentId} />
    </>
  );
};

export default SharedDocument;
