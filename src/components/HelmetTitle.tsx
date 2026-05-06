import { Helmet } from "@dr.pogodin/react-helmet";

const HelmetTitle = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  return (
    <Helmet>
      <title>Lotus | {title}</title>
      {description && <meta name="description" content={description} />}
    </Helmet>
  );
};

export default HelmetTitle;
