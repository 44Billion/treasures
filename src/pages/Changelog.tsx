import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PageLayout } from '@/components/PageLayout';
import changelogMd from '../../CHANGELOG.md?raw';

/**
 * Renders the project's CHANGELOG.md at runtime so users can read what's new
 * in any version without leaving the app. The markdown source is the same
 * file that drives the GitLab release description and store "What's new" copy,
 * so there's exactly one source of truth.
 */
export default function Changelog() {
  const { t } = useTranslation();

  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-2xl mx-auto">
        <div className="text-center pt-10 pb-6 px-4">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('changelog.title', "What's new")}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('changelog.subtitle', 'A running log of every Treasures release, written for finders and hiders.')}
          </p>
        </div>

        <article
          className={[
            'rounded-xl border bg-card mx-4 md:mx-0 mb-8 p-5 md:p-7',
            // Typography defaults — tuned to match other static info pages.
            'prose prose-sm md:prose-base max-w-none dark:prose-invert',
            // Headings: drop the top hero ("# Changelog"); style version headings.
            '[&>h1]:hidden',
            'prose-h2:mt-8 prose-h2:first:mt-0 prose-h2:text-xl prose-h2:font-bold prose-h2:text-foreground',
            'prose-h2:pb-2 prose-h2:border-b prose-h2:border-border',
            'prose-h3:text-sm prose-h3:font-semibold prose-h3:uppercase prose-h3:tracking-wide prose-h3:text-muted-foreground prose-h3:mt-5 prose-h3:mb-2',
            // Bullets and paragraphs sit closer together.
            'prose-ul:my-2 prose-li:my-1 prose-p:my-3',
            // Links pick up the brand colour and stay underlined.
            'prose-a:text-primary prose-a:underline',
            // Inline code keeps its rectangle but not the giant background.
            'prose-code:font-mono prose-code:text-xs prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none',
          ].join(' ')}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              a: ({ href, children, ...props }) => {
                const isExternal = href?.startsWith('http');
                return (
                  <a
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {changelogMd}
          </ReactMarkdown>
        </article>
      </div>
    </PageLayout>
  );
}
