import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { DesktopHeader } from "@/components/DesktopHeader";
import { Button } from "@/components/ui/button";

/**
 * The Big Ole Queer Market × Treasures event has ended.
 * This page is now a simple stub that notes the event is over and points
 * visitors back to the home page.
 */
export default function BOQM() {
  return (
    <>
      <DesktopHeader />
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Big Ole Queer Market × Treasures
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          This event has ended. Thanks to everyone who came out and joined the
          treasure hunt!
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
