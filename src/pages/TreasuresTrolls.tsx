import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { DesktopHeader } from "@/components/DesktopHeader";
import { Button } from "@/components/ui/button";

/**
 * The Treasure Trolls event has ended.
 * This page is now a simple stub that notes the event is over and points
 * visitors back to the home page.
 */
export default function TreasuresTrolls() {
  return (
    <>
      <DesktopHeader />
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Treasure Trolls
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          This event has ended. Thanks to everyone who joined the hunt for the
          trolls hidden across Oslo!
        </p>
        <Button asChild className="mt-8">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </>
  );
}
