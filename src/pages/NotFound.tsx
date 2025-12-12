import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    // Track 404 errors for analytics if needed
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-4">{t('notFound.message')}</p>
        <Link to="/">
          <Button>{t('notFound.returnHome')}</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
