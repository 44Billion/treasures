import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { NIP_GC_KINDS, buildAdventureTags } from '@/utils/nip-gc';
import type { CreateAdventureData, UpdateAdventureData } from '@/types/adventure';

/**
 * Hook to create or update an adventure (kind 37517 geocache curation list).
 */
export function useCreateAdventure() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAdventureData | UpdateAdventureData) => {
      const dTag = 'dTag' in data
        ? data.dTag
        : `adventure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const tags = buildAdventureTags({
        dTag,
        title: data.title,
        summary: data.summary,
        image: data.image,
        location: data.location,
        theme: data.theme,
        mapStyle: data.mapStyle,
        geocacheRefs: data.geocacheRefs,
      });

      const event = await publishEvent({
        kind: NIP_GC_KINDS.ADVENTURE,
        content: data.description,
        tags,
      });

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adventures'] });
      queryClient.invalidateQueries({ queryKey: ['adventure'] });
    },
  });
}
