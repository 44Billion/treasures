import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DittoIcon } from "@/components/icons/DittoIcon";

interface UnsupportedNaddrProps {
  /** The original naddr from the URL, used to build the Ditto link. */
  naddr: string;
}

/**
 * Friendly fallback shown when a valid naddr points at a Nostr event kind that
 * Treasures can't render (i.e. anything that isn't a treasure or a blog post).
 * The content still lives on Nostr, so we offer to open it on Ditto.
 */
export function UnsupportedNaddr({ naddr }: UnsupportedNaddrProps) {
  const { t } = useTranslation();
  const dittoUrl = `https://ditto.pub/${naddr}`;

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <DittoIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {t('unsupportedNaddr.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('unsupportedNaddr.description')}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <a href={dittoUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full min-h-11">
              <DittoIcon className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('unsupportedNaddr.viewOnDitto')}
              <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
            </Button>
          </a>

          <Link to="/" className="block">
            <Button variant="outline" className="w-full min-h-11">
              <Home className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('unsupportedNaddr.returnHome')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default UnsupportedNaddr;
