import { NostrEvent } from '@nostrify/nostrify';
import { BlogPost, CreateBlogPostData } from '@/types/blog';
import { BLOG_TAG, BLOG_POST_KIND } from '@/config/blog';

/**
 * Convert a Nostr event to a BlogPost object
 */
export function eventToBlogPost(event: NostrEvent): BlogPost | null {
  if (event.kind !== BLOG_POST_KIND) {
    return null;
  }

  // Extract tags
  const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
  const title = event.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled';
  const summary = event.tags.find(tag => tag[0] === 'summary')?.[1];
  const image = event.tags.find(tag => tag[0] === 'image')?.[1];
  const publishedAtTag = event.tags.find(tag => tag[0] === 'published_at')?.[1];
  const topicTags = event.tags.filter(tag => tag[0] === 't').map(tag => tag[1]).filter(Boolean) as string[];

  // Validate required fields
  if (!dTag) {
    console.warn('Blog post missing d tag:', event.id);
    return null;
  }

  // Check if it has the treasures tag
  if (!topicTags.includes(BLOG_TAG)) {
    return null;
  }

  const publishedAt = publishedAtTag ? parseInt(publishedAtTag) : event.created_at;

  return {
    id: event.id,
    pubkey: event.pubkey,
    title,
    content: event.content,
    summary,
    image,
    publishedAt,
    createdAt: event.created_at,
    tags: topicTags,
    dTag,
    event,
  };
}

/**
 * Create a blog post event from blog post data
 */
export function createBlogPostEvent(data: CreateBlogPostData): Partial<NostrEvent> {
  const dTag = data.dTag || generateDTag(data.title);
  const tags: string[][] = [
    ['d', dTag],
    ['title', data.title],
    ['t', BLOG_TAG], // Always include the treasures tag
  ];

  // Add optional tags
  if (data.summary) {
    tags.push(['summary', data.summary]);
  }

  if (data.image) {
    tags.push(['image', data.image]);
  }

  // Add published_at timestamp
  tags.push(['published_at', Math.floor(Date.now() / 1000).toString()]);

  // Add additional topic tags
  if (data.tags) {
    data.tags.forEach(tag => {
      if (tag && tag !== BLOG_TAG) { // Don't duplicate the treasures tag
        tags.push(['t', tag]);
      }
    });
  }

  return {
    kind: BLOG_POST_KIND,
    content: data.content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Generate a d tag from a title
 */
export function generateDTag(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50) // Limit length
    || `post-${Date.now()}`; // Fallback if title is empty
}

/**
 * Extract excerpt from content
 */
export function extractExcerpt(content: string, maxLength: number = 200): string {
  // Remove markdown formatting for excerpt
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
    .replace(/`(.*?)`/g, '$1') // Remove code formatting
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find the last complete word within the limit
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) { // If we can find a good break point
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Validate blog post data
 */
export function validateBlogPostData(data: CreateBlogPostData): string[] {
  const errors: string[] = [];

  if (!data.title?.trim()) {
    errors.push('Title is required');
  }

  if (!data.content?.trim()) {
    errors.push('Content is required');
  }

  if (data.title && data.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (data.summary && data.summary.length > 500) {
    errors.push('Summary must be less than 500 characters');
  }

  return errors;
}

/**
 * Check if a pubkey is an authorized author
 */
export function isAuthorizedAuthor(pubkey: string, authorizedAuthors: string[]): boolean {
  return authorizedAuthors.includes(pubkey);
}