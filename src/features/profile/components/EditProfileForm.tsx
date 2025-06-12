import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useToast } from '@/shared/hooks/useToast';
import { Form } from '@/shared/components/ui/form';
import { LoadingButton } from '@/shared/components/ui/button-extensions';
import { 
  TextField, 
  TextAreaField, 
  SwitchField, 
  ImageUploadField 
} from '@/shared/components/ui/form-fields';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { NSchema as n, type NostrMetadata } from '@nostrify/nostrify';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadFile } from '@/shared/hooks/useUploadFile';
import { PublishTroubleshooter } from '@/components/PublishTroubleshooter';
import { Settings, User, Image, Globe } from 'lucide-react';
import type { EditProfileFormProps } from '../types';

export const EditProfileForm: React.FC<EditProfileFormProps> = ({ onSuccess }) => {
  const queryClient = useQueryClient();
  const [publishError, setPublishError] = useState<string | null>(null);

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

    // Clear any previous errors
    setPublishError(null);

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
      const errorObj = error as { message?: string };
      const errorMessage = errorObj.message || 'Failed to update your profile. Please try again.';
      
      // Set the error for the troubleshooter
      setPublishError(errorMessage);
      
      // Also show a toast for immediate feedback
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRetry = () => {
    // Clear the error and resubmit the form
    setPublishError(null);
    form.handleSubmit(onSubmit)();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Your public profile information that others will see.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TextField
              control={form.control}
              name="name"
              label="Display Name"
              placeholder="Your name"
              description="This is how your name will appear to others."
            />

            <TextAreaField
              control={form.control}
              name="about"
              label="Bio"
              placeholder="Tell others about yourself..."
              description="A short description about yourself."
            />
          </CardContent>
        </Card>

        {/* Profile Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Profile Images
            </CardTitle>
            <CardDescription>
              Upload or provide URLs for your profile picture and banner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ImageUploadField
                control={form.control}
                name="picture"
                label="Profile Picture"
                placeholder="https://example.com/profile.jpg"
                description="Square image that represents you."
                previewType="square"
                onUpload={(file) => uploadPicture(file, 'picture')}
              />

              <ImageUploadField
                control={form.control}
                name="banner"
                label="Banner Image"
                placeholder="https://example.com/banner.jpg"
                description="Wide banner image for your profile header."
                previewType="wide"
                onUpload={(file) => uploadPicture(file, 'banner')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-left">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Options
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card className="border-0 shadow-none">
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextField
                      control={form.control}
                      name="website"
                      label="Website"
                      placeholder="https://yourwebsite.com"
                      description="Your personal website or blog."
                      type="url"
                    />

                    <TextField
                      control={form.control}
                      name="nip05"
                      label="NIP-05 Identifier"
                      placeholder="you@example.com"
                      description="Your verified Nostr address (requires domain setup)."
                      type="email"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      Account Type
                    </div>
                    <SwitchField
                      control={form.control}
                      name="bot"
                      label="Bot Account"
                      description="Enable this if this account is automated or represents a bot/service."
                    />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <LoadingButton
            type="submit" 
            className="flex-1 sm:flex-none sm:min-w-[120px]" 
            isLoading={isPending || isUploading}
            loadingText="Saving..."
          >
            Save Profile
          </LoadingButton>
          
          {onSuccess && (
            <LoadingButton
              type="button"
              variant="outline"
              onClick={onSuccess}
              className="flex-1 sm:flex-none"
              disabled={isPending || isUploading}
            >
              Cancel
            </LoadingButton>
          )}
        </div>
      </form>

      {publishError && (
        <div className="mt-6">
          <PublishTroubleshooter 
            error={publishError} 
            onRetry={handleRetry}
            isRetrying={isPending}
          />
        </div>
      )}
    </Form>
  );
};