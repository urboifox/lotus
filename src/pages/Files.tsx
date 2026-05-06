import CustomSection from "@/components/ui/CustomSection";
import Title from "@/components/ui/Title";
import { EditIcon, EyeIcon, GridIcon, List, Share2, TrashIcon } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HelmetTitle from "@/components/HelmetTitle";
import { GetAllDocuments, useDeleteDocument } from "@/services/docs";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useQueryClient } from "@tanstack/react-query";
import ShareModal from "@/components/writing/content/ShareModal";
import type { LotusDocument } from "@/services/docs";

const Files = () => {
  const [view, setView] = useState<"list" | "grid">("list");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [shareDialogDoc, setShareDialogDoc] = useState<LotusDocument | null>(
    null,
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = GetAllDocuments();
  const deleteDocumentMutation = useDeleteDocument();

  const documents: LotusDocument[] = Array.isArray(data)
    ? data
    : data?.items || [];

  function getIconClasses(vieww: "list" | "grid") {
    return view === vieww
      ? "text-[#FAE5C8] bg-[#A97C3C]"
      : "text-footer bg-[#F9E3C6]";
  }

  const handleView = (docId: string) => {
    navigate(`/docs/${docId}`);
  };

  const handleEdit = (doc: LotusDocument) => {
    navigate("/writing", { state: { document: doc } });
  };

  const handleDeleteClick = (docId: string) => {
    setSelectedDocId(docId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedDocId) {
      try {
        await deleteDocumentMutation.mutateAsync(selectedDocId);
        // Refresh the documents list
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        setDeleteDialogOpen(false);
        setSelectedDocId(null);
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <CustomSection className="mt-32">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Loading...</div>
        </div>
      </CustomSection>
    );
  }
  return (
    // <div className="container">
    <CustomSection className="mt-32">
      <HelmetTitle
        title="My Files"
        description="View and manage your saved hieroglyphic writing and translation projects"
      />
      <Title
        title="My Files"
        description="View and manage your saved hieroglyphic writing and translation projects."
      />
      <motion.div
        className="flex items-center justify-end gap-2 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <List
            onClick={() => setView("list")}
            className={`w-10 h-10 border border-[#D8A8659C] p-2 rounded-lg cursor-pointer transition-colors duration-300 ${getIconClasses(
              "list"
            )}`}
          />
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <GridIcon
            onClick={() => setView("grid")}
            className={`w-10 h-10 border border-[#D8A8659C] p-2 rounded-lg cursor-pointer transition-colors duration-300 ${getIconClasses(
              "grid"
            )}`}
          />
        </motion.div>
      </motion.div>
      <AnimatePresence mode="wait">
        {view === "list" && (
          <motion.div
            className="overflow-x-auto"
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <table className="w-full rounded-t-lg border border-[#D8A8659C]">
              <thead className="bg-[#FAE5C8] text-lg font-semibold text-center text-secondary border-b border-[#D8A8659C] rounded-t-lg">
                <tr className="rounded-t-lg">
                  <th className="px-2 py-4">File Name</th>
                  <th className="px-2 py-4">Translation</th>
                  <th className="px-2 py-4">Status</th>
                  <th className="px-2 py-4">Create Date</th>
                  <th className="px-2 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="text-lg font-normal font-playfair-display text-center bg-background">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-gray-600">
                      No saved documents yet.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc, index) => (
                    <motion.tr
                      className="border-b border-[#D8A8659C]"
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.08,
                        ease: "easeOut",
                      }}
                      whileHover={{
                        backgroundColor: "rgba(169, 124, 60, 0.05)",
                        transition: { duration: 0.2 },
                      }}
                    >
                      <td className="px-2 py-4">
                        {doc.title || "Untitled Document"}
                      </td>
                      <td className="px-2 py-4">
                        <div
                          className="line-clamp-2 max-w-md mx-auto"
                          dangerouslySetInnerHTML={{
                            __html: doc.html?.substring(0, 100) || "—",
                          }}
                        />
                      </td>
                      <td className="px-2 py-4">
                        {doc.is_shared ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                            Shared
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600">
                            Private
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-4">
                        {new Date(doc.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-4 flex items-center justify-center gap-2">
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                          }}
                        >
                          <EyeIcon
                            size={36}
                            onClick={() => handleView(doc.id)}
                            className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-[#A97C3C] hover:text-white transition-colors duration-200"
                          />
                        </motion.div>
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: -5 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                          }}
                        >
                          <EditIcon
                            size={36}
                            onClick={() => handleEdit(doc)}
                            className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-[#A97C3C] hover:text-white transition-colors duration-200"
                          />
                        </motion.div>
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                          }}
                        >
                          <Share2
                            size={36}
                            onClick={() => setShareDialogDoc(doc)}
                            className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-[#A97C3C] hover:text-white transition-colors duration-200"
                          />
                        </motion.div>
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                          }}
                        >
                          <TrashIcon
                            size={36}
                            onClick={() => handleDeleteClick(doc.id)}
                            className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-red-500 hover:text-white transition-colors duration-200"
                          />
                        </motion.div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {view === "grid" && (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {documents.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-600">
                No saved documents yet.
              </div>
            ) : (
              documents.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  className="bg-background rounded-lg border border-[#D8A8659C] p-2"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: "easeOut",
                  }}
                  whileHover={{
                    y: -5,
                    scale: 1.02,
                    boxShadow: "0 10px 25px rgba(169, 124, 60, 0.15)",
                    transition: { duration: 0.2 },
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="w-full h-38 flex items-center justify-center bg-[#FAE5C8] rounded-lg mb-2 border border-[#D8A8659C]"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.img
                      src={"/images/footerlogo.png"}
                      alt="footerlogo"
                      className="w-10 h-10 object-cover"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.7, ease: "easeInOut" }}
                    />
                  </motion.div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-center font-playfair-display">
                      {doc.title || "Untitled"}
                    </h2>
                    {doc.is_shared && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                        Shared
                      </span>
                    )}
                    <p className="text-sm font-normal text-center font-poppins">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className="text-base font-normal text-left font-playfair-display mb-2 line-clamp-3 min-h-[4.5rem]"
                    dangerouslySetInnerHTML={{
                      __html: doc.html?.substring(0, 150) || "No content...",
                    }}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                    >
                      <EyeIcon
                        size={36}
                        onClick={() => handleView(doc.id)}
                        className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-[#A97C3C] hover:text-white transition-colors duration-200"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                    >
                      <EditIcon
                        size={36}
                        onClick={() => handleEdit(doc)}
                        className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-[#A97C3C] hover:text-white transition-colors duration-200"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                    >
                      <Share2
                        size={36}
                        onClick={() => setShareDialogDoc(doc)}
                        className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-[#A97C3C] hover:text-white transition-colors duration-200"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                    >
                      <TrashIcon
                        size={36}
                        onClick={() => handleDeleteClick(doc.id)}
                        className="p-2 bg-[#F9E3C6] text-footer cursor-pointer border border-[#A97C3C] rounded-lg hover:bg-red-500 hover:text-white transition-colors duration-200"
                      />
                    </motion.div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              document from the server.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteDocumentMutation.isPending}
              className="px-4 py-2 border border-[#D8A8659C] text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteDocumentMutation.isPending}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ShareModal
        open={Boolean(shareDialogDoc)}
        onOpenChange={(open) => {
          if (!open) setShareDialogDoc(null);
        }}
        documentId={shareDialogDoc?.id}
        documentTitle={shareDialogDoc?.title}
      />
    </CustomSection>
  );
};

export default Files;
