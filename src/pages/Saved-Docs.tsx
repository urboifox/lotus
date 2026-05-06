// import CustomSection from "@/components/ui/CustomSection";
// import { useNavigate } from "react-router-dom";
// import { GetAllDocuments } from "@/services/docs";

// interface Document {
//   id: string;
//   title: string;
//   updated_at: string;
//   approx_lines: number;
//   privacy: string;
// }

// const SavedDocs = () => {
//   const navigate = useNavigate();
//   const { data, isLoading } = GetAllDocuments();

//   const documents: Document[] = Array.isArray(data)
//     ? data
//     : data?.documents || [];

//   const handleViewDocument = (docId: string) => {
//     navigate(`/docs/${docId}`);
//   };

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-xl">Loading...</div>
//       </div>
//     );
//   }

//   return (
//     // <div className="min-h-screen bg-gray-50 p-8">
//     <CustomSection className="mt-32 min-h-screen ">
//       <div className="w-full mx-auto min-h-screen border border-[#D8A8659C] rounded-md p-4">
//         <h1 className="text-3xl font-bold mb-8 text-gray-900">
//           Saved Documents
//         </h1>

//         {documents.length === 0 ? (
//           <div className="bg-white rounded-lg shadow p-8 text-center">
//             <p className="text-gray-600">No saved documents yet.</p>
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {documents.map((doc) => (
//               <div
//                 key={doc.id}
//                 className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
//                 onClick={() => handleViewDocument(doc.id)}
//               >
//                 <div className="flex justify-between items-start mb-3">
//                   <h3 className="text-xl font-semibold text-gray-900 flex-1">
//                     {doc.title || "Untitled Document"}
//                   </h3>
//                   {/* <span
//                     className={`px-2 py-1 text-xs rounded font-medium ${
//                       doc.privacy === "PUBLIC"
//                         ? "bg-green-100 text-green-700"
//                         : "bg-blue-100 text-blue-700"
//                     }`}
//                   >
//                     {doc.privacy}
//                   </span> */}
//                 </div>

//                 <p className="text-sm text-gray-500 mb-2">
//                   Updated: {new Date(doc.updated_at).toLocaleDateString()}
//                 </p>
//                 <button className="mt-4 px-4 py-2 bg-[#ccaa83] text-white rounded hover:bg-[#b89973] transition-colors w-full">
//                   View Document
//                 </button>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </CustomSection>

//     // </div>
//   );
// };

// export default SavedDocs;
