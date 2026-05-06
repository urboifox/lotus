import { Link } from "react-router-dom";
import HelmetTitle from "@/components/HelmetTitle";

const PaymentCancel = () => {
  return (
    <div className="min-h-screen pt-32 pb-16 px-4">
      <HelmetTitle title="Payment cancelled" description="Subscription" />
      <div className="container max-w-lg mx-auto bg-[#F7D8AD] rounded-2xl border border-primary p-8 shadow-lg text-center">
        <h1 className="text-2xl font-playfair-display font-bold text-secondary mb-4">
          Payment cancelled
        </h1>
        <p className="text-secondary/80 font-poppins mb-6">
          No charges were made. You can choose a plan again whenever you are
          ready.
        </p>
        <Link
          to="/writing"
          className="inline-block px-6 py-2.5 bg-[#ccaa83] text-white rounded-md font-medium mr-3"
        >
          Back to writing
        </Link>
        <Link
          to="/"
          className="inline-block px-6 py-2.5 border border-secondary/30 text-secondary rounded-md font-medium"
        >
          Home
        </Link>
      </div>
    </div>
  );
};

export default PaymentCancel;
