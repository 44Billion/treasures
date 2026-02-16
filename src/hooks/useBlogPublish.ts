import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { CreateBlogPostData, UpdateBlogPostData } from '@/types/blog';
import { createBlogPostEvent, validateBlogPostData } from '../utils/blogUtils';

/**
 * Hook to publish a new blog post
 */
export function useCreateBlogPost() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBlogPostData) => {
      // Validate the data
      const errors = validateBlogPostData(data);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      // Create the event template
      const eventTemplate = createBlogPostEvent(data);
      
      // Ensure kind is defined
      if (!eventTemplate.kind) {
        throw new Error('Event kind is required');
      }
      
      // Publish the event using the shared hook (handles retries and error handling)
      const event = await publishEvent({
        kind: eventTemplate.kind as number,
        content: eventTemplate.content || '',
        tags: eventTemplate.tags || [],
      });

      return event;
    },
    onSuccess: (event) => {
      // Invalidate blog post queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['blog', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['blog', 'posts', 'author', event.pubkey] });
    },
  });
}

/**
 * Hook to update an existing blog post
 */
export function useUpdateBlogPost() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateBlogPostData) => {
      // Validate the data
      const errors = validateBlogPostData(data);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      if (!data.dTag) {
        throw new Error('dTag is required for updating blog posts');
      }

      // Create the event template (this will replace the previous one with the same d tag)
      const eventTemplate = createBlogPostEvent(data);
      
      // Publish the event using the shared hook (handles retries and error handling)
      const event = await publishEvent({
        kind: eventTemplate.kind as number,
        content: eventTemplate.content || '',
        tags: eventTemplate.tags || [],
      });

      return event;
    },
    onSuccess: (event) => {
      // Invalidate blog post queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['blog', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['blog', 'posts', 'author', event.pubkey] });
      
      // Also invalidate the specific post query
      const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
      if (dTag) {
        queryClient.invalidateQueries({ queryKey: ['blog', 'post', event.pubkey, dTag] });
      }
    },
  });
}

/**
 * Hook to delete a blog post (using NIP-09 deletion events)
 */
export function useDeleteBlogPost() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason?: string }) => {
      // Create a deletion event template (kind 5)
      const deletionEventTemplate = {
        kind: 5,
        content: reason || 'Blog post deleted',
        tags: [['e', eventId]],
        created_at: Math.floor(Date.now() / 1000),
      };

      // Publish the deletion event using the shared hook (handles retries and error handling)
      const deletionEvent = await publishEvent(deletionEventTemplate);

      return deletionEvent;
    },
    onSuccess: (_deletionEvent) => {
      // Invalidate all blog post queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['blog'] });
    },
  });
}