import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, Map, Bookmark, ScanQrCode, BookOpen, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const suggestions: Array<{
    to: string;
    labelKey: string;
    fallback: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { to: "/map", labelKey: "notFound.exploreMap", fallback: "Explore Map", icon: Map },
    { to: "/saved", labelKey: "notFound.myCaches", fallback: "My Caches", icon: Bookmark },
    { to: "/claim", labelKey: "notFound.claim", fallback: "Claim a Treasure", icon: ScanQrCode },
    { to: "/blog", labelKey: "notFound.blog", fallback: "Blog", icon: BookOpen },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <Compass className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <p className="text-lg text-muted-foreground">{t('notFound.message')}</p>
          <p className="text-sm text-muted-foreground break-all">
            {t('notFound.attemptedPath', {
              path: location.pathname,
              defaultValue: "We couldn't find anything at {{path}}.",
            })}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link to="/" className="block">
            <Button className="w-full min-h-11">
              <Home className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('notFound.returnHome')}
            </Button>
          </Link>

          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-2">
              {t('notFound.tryInstead', { defaultValue: 'Try one of these instead:' })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map(({ to, labelKey, fallback, icon: Icon }) => (
                <Link key={to} to={to}>
                  <Button variant="outline" className="w-full min-h-11 justify-start">
                    <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
                    <span className="truncate">{t(labelKey, { defaultValue: fallback })}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
