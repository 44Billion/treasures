import { ExternalLink, MapPin, Compass, Zap, Globe, Users, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CacheIcon } from "@/features/geocache/utils/cacheIcons";
import { useTheme } from 'next-themes';
import { NIP_GC_KINDS } from "@/features/geocache/utils/nip-gc";

export default function About() {
  const { theme } = useTheme();
  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-8">
              <img 
                src="/icon.svg" 
                alt="Treasures" 
                className="w-48 h-48" 
              />
            </div>
            <CardTitle className="text-4xl font-bold mb-4 text-foreground">
              About Treasures
            </CardTitle>
            <CardDescription className="text-xl max-w-2xl mx-auto">
              Decentralized geocaching on the Nostr protocol
            </CardDescription>
          </CardHeader>
        </Card>

        {/* What is Geocaching */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              What is Geocaching?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Geocaching is a real-world treasure hunting game where participants use GPS coordinates 
              to find hidden containers called "geocaches" or "caches." These containers are placed 
              by other geocachers and can be found in urban areas, parks, forests, and remote locations 
              around the world.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Each geocache contains a logbook where finders can record their visit, and larger caches 
              may contain small trinkets for trading. The game combines outdoor adventure, problem-solving, 
              and exploration, encouraging people to discover new places and hidden gems in their communities.
            </p>
          </CardContent>
        </Card>

        {/* What is Treasures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6" />
              What is Treasures?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Treasures is a decentralized geocaching platform built on the Nostr protocol. Unlike 
              traditional geocaching platforms that rely on centralized servers, Treasures uses a 
              network of relays to store and distribute geocache data, making it censorship-resistant 
              and globally accessible.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              With Treasures, you can create, find, and log geocaches using your Nostr identity. 
              The platform supports offline functionality, real-time updates, and seamless integration 
              with the broader Nostr ecosystem. Your geocaching activity is tied to your cryptographic 
              identity, ensuring authenticity while maintaining privacy.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Decentralized</h4>
                  <p className="text-sm text-muted-foreground">No single point of failure</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Censorship Resistant</h4>
                  <p className="text-sm text-muted-foreground">Cannot be taken down</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Community Owned</h4>
                  <p className="text-sm text-muted-foreground">Built by geocachers, for geocachers</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Real-time Updates</h4>
                  <p className="text-sm text-muted-foreground">Instant synchronization</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currently Supported Cache Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-6 w-6" />
              Supported Cache Types
            </CardTitle>
            <CardDescription>
              Treasures supports the most popular geocache types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Traditional Cache */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 border rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center">
                  <CacheIcon type="traditional" size="lg" theme={theme} />
                </div>
                <div>
                  <h4 className="font-semibold">Traditional</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    The classic geocache type. A container hidden at the given coordinates 
                    with a logbook inside.
                  </p>
                </div>
                <Badge variant="outline">Most Common</Badge>
              </div>

              {/* Multi-Cache */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 border rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center">
                  <CacheIcon type="multi" size="lg" theme={theme} />
                </div>
                <div>
                  <h4 className="font-semibold">Multi-Cache</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    A sequence of locations leading to the final cache. Solve clues 
                    at each stage to find the next.
                  </p>
                </div>
                <Badge variant="outline">Adventure</Badge>
              </div>

              {/* Mystery Cache */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 border rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center">
                  <CacheIcon type="mystery" size="lg" theme={theme} />
                </div>
                <div>
                  <h4 className="font-semibold">Mystery</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Puzzle caches that require solving a mystery or puzzle to 
                    determine the final coordinates.
                  </p>
                </div>
                <Badge variant="outline">Puzzle</Badge>
              </div>
            </div>


          </CardContent>
        </Card>

        {/* What is Treasures built with? */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6" />
              What is Treasures built with?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Treasures is built on the Nostr protocol, a simple, open protocol that enables global, 
              decentralized, and censorship-resistant communication. Nostr leverages a network of relays 
              to create applications that can't be shut down or controlled by any single entity.
            </p>
            
            <p className="text-muted-foreground leading-relaxed">
              The application was created using the <code className="bg-muted px-2 py-1 rounded text-sm">stacks</code> command 
              in combination with <a 
                href="https://getstacks.dev/stack/naddr1qvzqqqrhl5pzqprpljlvcnpnw3pejvkkhrc3y6wvmd7vjuad0fg2ud3dky66gaxaqqrk66mnw3skx6c4g6ltw"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline font-medium"
              >
                mkstack
              </a>, a powerful toolkit for building Nostr applications with modern web technologies.
            </p>
            
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <a 
                  href="https://getstacks.dev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Learn more at GetStacks.dev
                </a>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Nostr Protocol</h4>
                  <p className="text-sm text-muted-foreground">Decentralized, censorship-resistant</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Modern Stack</h4>
                  <p className="text-sm text-muted-foreground">React, TypeScript, TailwindCSS</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Open Source</h4>
                  <p className="text-sm text-muted-foreground">Community-driven development</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">Real-time</h4>
                  <p className="text-sm text-muted-foreground">Instant updates via relays</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What kind of events does this site use? */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-6 w-6" />
              What kind of events does this site use? Is there a NIP?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Treasures uses custom Nostr event kinds defined in NIP-GC (Geocaching Events). 
              This specification defines how geocaches and logs are stored and shared across the Nostr network.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Kind {NIP_GC_KINDS.GEOCACHE}</h4>
                <p className="text-sm text-muted-foreground">
                  Geocache listings with location, difficulty, terrain, and cache details
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Kind {NIP_GC_KINDS.FOUND_LOG}</h4>
                <p className="text-sm text-muted-foreground">
                  Found logs recording successful geocache visits
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Kind {NIP_GC_KINDS.VERIFICATION}</h4>
                <p className="text-sm text-muted-foreground">
                  Verification events providing cryptographic proof of cache finds
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Kind {NIP_GC_KINDS.COMMENT_LOG}</h4>
                <p className="text-sm text-muted-foreground">
                  Comment logs for DNF, notes, and maintenance reports
                </p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <a 
                  href="https://nostrhub.io/naddr1qvzqqqrcvypzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qqgkwet0vdskx6rfdenj6etkv4h8guc6gs5y5" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read the full NIP-GC specification
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Treasures is open source and community-driven.
              </p>
              <div className="flex justify-center">
                <Button variant="outline" asChild>
                  <a 
                    href="https://gitlab.com/chad.curtis/treasures" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Source Code
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
