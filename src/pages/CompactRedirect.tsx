import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { decodeCompactUrl, compactToNaddr } from "@/utils/compactUrl";
import { ComponentLoading } from "@/components/ui/loading";
import { PageLayout } from "@/components/PageLayout";

/**
 * Handles compact URL format: /c/{base64url-payload}
 * Decodes the payload and redirects to the standard cache detail page with verification hash
 */
export default function CompactRedirect() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!payload) {
      navigate("/404", { replace: true });
      return;
    }

    // Decode the compact URL
    const decoded = decodeCompactUrl(payload);
    
    if (!decoded) {
      console.error("Failed to decode compact URL payload:", payload);
      navigate("/404", { replace: true });
      return;
    }

    // Convert to standard naddr format
    const naddr = compactToNaddr(decoded.pubkey, decoded.dTag, decoded.kind);
    
    // Redirect to standard cache detail page with verification hash
    const targetUrl = `/${naddr}#verify=${decoded.nsec}`;
    
    // Use replace so back button doesn't get stuck on this redirect page
    navigate(targetUrl, { replace: true });
  }, [payload, navigate]);

  return (
    <PageLayout maxWidth="md" className="py-16">
      <div className="flex flex-col items-center justify-center">
        <ComponentLoading size="lg" title="Loading treasure..." />
      </div>
    </PageLayout>
  );
}

