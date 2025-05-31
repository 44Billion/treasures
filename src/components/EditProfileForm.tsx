import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { Form } from '@/components/ui/form';
import { LoadingButton } from '@/components/ui/button-extensions';
import { 
  TextField, 
  TextAreaField, 
  SwitchField, 
  ImageUploadField 
} from '@/components/ui/form-fields';
import { NSchema as n, type NostrMetadata } from '@nostrify/nostrify';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadFile } from '@/hooks/useUploadFile';

interface EditProfileFormProps {
  onSuccess?: () => void;
}

export const EditProfileForm: React.FC<EditProfileFormProps> = ({ onSuccess }) => {
  const queryClient = useQueryClient();

  const { user, metadata } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();

  // Initialize the form with default values
  const form = useForm<NostrMetadata>({
    resolver: zodResolver(n.metadata()),
    defaultValues: {
      name: '',
      about: '',
      picture: '',
      banner: '',
      website: '',
      nip05: '',
      bot: false,
    },
  });

  // Update form values when user data is loaded
  useEffect(() => {
    if (metadata) {
      form.reset({
        name: metadata.name || '',
        about: metadata.about || '',
        picture: metadata.picture || '',
        banner: metadata.banner || '',
        website: metadata.website || '',
        nip05: metadata.nip05 || '',
        bot: metadata.bot || false,
      });
    }
  }, [metadata, form]);

  // Handle file uploads for profile picture and banner
  const uploadPicture = async (file: File, field: 'picture' | 'banner') => {
    try {
      // The first tuple in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      form.setValue(field, url);
      toast({
        title: 'Success',
        description: `${field === 'picture' ? 'Profile picture' : 'Banner'} uploaded successfully`,
      });
    } catch (error) {
      console.error(`Failed to upload ${field}:`, error);
      toast({
        title: 'Error',
        description: `Failed to upload ${field === 'picture' ? 'profile picture' : 'banner'}. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: NostrMetadata) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to update your profile',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Combine existing metadata with new values
      const data = { ...metadata, ...values };

      // Clean up empty values
      for (const key in data) {
        if (data[key] === '') {
          delete data[key];
        }
      }

      // Publish the metadata event (kind 0)
      await publishEvent({
        kind: 0,
        content: JSON.stringify(data),
      });

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['logins'] });
      queryClient.invalidateQueries({ queryKey: ['author', user.pubkey] });

      toast({
        title: 'Success',
        description: 'Your profile has been updated',
      });

      // Call onSuccess callback if provided (to close modal)
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update your profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <TextField
          control={form.control}
          name="name"
          label="Name"
          placeholder="Your name"
          description="This is your display name that will be displayed to others."
        />

        <TextAreaField
          control={form.control}
          name="about"
          label="Bio"
          placeholder="Tell others about yourself"
          description="A short description about yourself."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImageUploadField
            control={form.control}
            name="picture"
            label="Profile Picture"
            placeholder="https://example.com/profile.jpg"
            description="URL to your profile picture. You can upload an image or provide a URL."
            previewType="square"
            onUpload={(file) => uploadPicture(file, 'picture')}
          />

          <ImageUploadField
            control={form.control}
            name="banner"
            label="Banner Image"
            placeholder="https://example.com/banner.jpg"
            description="URL to a wide banner image for your profile. You can upload an image or provide a URL."
            previewType="wide"
            onUpload={(file) => uploadPicture(file, 'banner')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TextField
            control={form.control}
            name="website"
            label="Website"
            placeholder="https://yourwebsite.com"
            description="Your personal website or social media link."
            type="url"
          />

          <TextField
            control={form.control}
            name="nip05"
            label="NIP-05 Identifier"
            placeholder="you@example.com"
            description="Your verified Nostr identifier."
            type="email"
          />
        </div>

        <SwitchField
          control={form.control}
          name="bot"
          label="Bot Account"
          description="Mark this account as automated or a bot."
        />

        <LoadingButton
          type="submit" 
          className="w-full md:w-auto" 
          isLoading={isPending || isUploading}
          loadingText="Saving..."
        >
          Save Profile
        </LoadingButton>
      </form>
    </Form>
  );
};

