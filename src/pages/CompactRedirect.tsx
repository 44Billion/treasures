import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { decodeCompactUrl, compactToNaddr } from "@/utils/compactUrl";
import { ComponentLoading } from "@/components/ui/loading";
import { PageLayout } from "@/components/PageLayout";
import NotFound from "@/pages/NotFound";

/**
 * Handles compact URL format: /c/{base64url-payload}
 * Decodes the payload and redirects to the standard cache detail page with verification hash
 */
export default function CompactRedirect() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!payload) {
      setNotFound(true);
      return;
    }

    // Decode the compact URL
    const decoded = decodeCompactUrl(payload);
    
    if (!decoded) {
      console.error("Failed to decode compact URL payload:", payload);
      setNotFound(true);
      return;
    }

    // Convert to standard naddr format
    const naddr = compactToNaddr(decoded.pubkey, decoded.dTag, decoded.kind);
    
    // Redirect to standard cache detail page with verification hash
    const targetUrl = `/${naddr}#verify=${decoded.nsec}`;
    
    // Use replace so back button doesn't get stuck on this redirect page
    navigate(targetUrl, { replace: true });
  }, [payload, navigate]);

  // Render the 404 page in place so the invalid /c/... URL is preserved.
  if (notFound) {
    return <NotFound />;
  }

  return (
    <PageLayout maxWidth="md" className="py-16">
      <div className="flex flex-col items-center justify-center">
        <ComponentLoading size="lg" title="Loading treasure..." />
      </div>
    </PageLayout>
  );
}

