import CustomSection from "@/components/ui/CustomSection";
import { useParams, useNavigate } from "react-router-dom";
import { GetDocumentById } from "@/services/docs";

const DocsDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: document, isLoading } = GetDocumentById(id || "");

  const handleBackToList = () => {
    navigate("/files");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading document...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Document not found</p>
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-[#ccaa83] text-white rounded hover:bg-[#b89973] transition-colors"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <CustomSection className="mt-32">
      <div className="w-full p-4">
        {/* Header with back button */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-[#ccaa83] text-white rounded hover:bg-[#b89973] transition-colors"
          >
            ← Back to Documents
          </button>

          {/* <div className="flex gap-2">
            <span
              className={`px-3 py-1 text-sm rounded font-medium ${
                document.privacy === "PUBLIC"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {document.privacy}
            </span>
          </div> */}
        </div>

        {/* Document content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {document.title}
            </h1>
            <div className="flex gap-4 text-sm text-gray-500">
              {/* <span>Lines: {document.approx_lines}</span>
              <span>•</span> */}
              <span>
                Updated: {new Date(document.updated_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Render the HTML content */}
          <div
            className="document-content"
            dangerouslySetInnerHTML={{ __html: document.html }}
          />
        </div>
      </div>
    </CustomSection>
  );
};

export default DocsDetails;
