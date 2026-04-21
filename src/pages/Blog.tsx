import { BookOpen } from 'lucide-react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { PageHero } from '@/components/PageHero';
import { BlogList } from '@/components/BlogList';
import { BLOG_CONFIG } from '@/config/blog';

export default function Blog() {
  return (
    <>
      <DesktopHeader />

      <PageHero
        icon={BookOpen}
        title={BLOG_CONFIG.blogTitle}
        description={BLOG_CONFIG.blogDescription}
      >
        <div className="container mx-auto px-4 max-w-2xl pb-12">
          <BlogList />
        </div>
      </PageHero>
    </>
  );
}
