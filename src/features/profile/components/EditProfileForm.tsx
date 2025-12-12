import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      lud16: '',
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
        lud16: metadata.lud16 || '',
        bot: metadata.bot || false,
      });
    }
  }, [metadata, form]);

  // Handle file uploads for profile picture and banner
  const uploadPicture = async (file: File, field: 'picture' | 'banner') => {
    const fieldName = field === 'picture' ? 'Profile picture' : 'Banner';

    // Show upload starting toast
    toast({
      title: 'Uploading...',
      description: `Uploading ${fieldName.toLowerCase()}...`,
    });

    try {
      // The first tuple in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      form.setValue(field, url);
      const fieldName = field === 'picture' ? t('editProfile.upload.profilePicture') : t('editProfile.upload.banner');
      toast({
        title: t('editProfile.toast.success.title'),
        description: t('editProfile.toast.success.uploaded', { field: fieldName }),
      });
    } catch (error) {
      const fieldName = field === 'picture' ? t('editProfile.upload.profilePicture') : t('editProfile.upload.banner');
      const errorObj = error as { message?: string };
      toast({
        title: t('editProfile.toast.error.title'),
        description: errorObj.message || t('editProfile.toast.error.uploadFailed', { field: fieldName }),

        variant: 'destructive',
      });
      throw error; // Re-throw to let the ImageUploadField handle the loading state
    }
  };

  const onSubmit = async (values: NostrMetadata) => {
    if (!user) {
      toast({
        title: t('editProfile.toast.error.title'),
        description: t('editProfile.toast.error.notLoggedIn'),
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
        title: t('editProfile.toast.success.title'),
        description: t('editProfile.toast.success.updated'),
      });

      // Call onSuccess callback if provided (to close modal)
      onSuccess?.();
    } catch (error) {
      const errorObj = error as { message?: string };
      const errorMessage = errorObj.message || t('editProfile.toast.error.updateFailed');
      
      // Set the error for the troubleshooter
      setPublishError(errorMessage);

      // Also show a toast for immediate feedback
      toast({
        title: t('editProfile.toast.error.title'),
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
              {t('editProfile.basic.title')}
            </CardTitle>
            <CardDescription>
              {t('editProfile.basic.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TextField
              control={form.control}
              name="name"
              label={t('editProfile.basic.displayName.label')}
              placeholder={t('editProfile.basic.displayName.placeholder')}
              description={t('editProfile.basic.displayName.description')}
            />

            <TextAreaField
              control={form.control}
              name="about"
              label={t('editProfile.basic.bio.label')}
              placeholder={t('editProfile.basic.bio.placeholder')}
              description={t('editProfile.basic.bio.description')}
            />
          </CardContent>
        </Card>

        {/* Profile Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              {t('editProfile.images.title')}
            </CardTitle>
            <CardDescription>
              {t('editProfile.images.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ImageUploadField
                control={form.control}
                name="picture"
                label={t('editProfile.images.picture.label')}
                placeholder={t('editProfile.images.picture.placeholder')}
                description={t('editProfile.images.picture.description')}
                previewType="square"
                onUpload={(file) => uploadPicture(file, 'picture')}
                isUploading={isUploading}
              />

              <ImageUploadField
                control={form.control}
                name="banner"
                label={t('editProfile.images.banner.label')}
                placeholder={t('editProfile.images.banner.placeholder')}
                description={t('editProfile.images.banner.description')}
                previewType="wide"
                onUpload={(file) => uploadPicture(file, 'banner')}
                isUploading={isUploading}
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
                {t('editProfile.advanced.title')}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card className="border-0 shadow-none">
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextField
                      control={form.control}
                      name="website"
                      label={t('editProfile.advanced.website.label')}
                      placeholder={t('editProfile.advanced.website.placeholder')}
                      description={t('editProfile.advanced.website.description')}
                      type="url"
                    />

                    <TextField
                      control={form.control}
                      name="nip05"
                      label={t('editProfile.advanced.nip05.label')}
                      placeholder={t('editProfile.advanced.nip05.placeholder')}
                      description={t('editProfile.advanced.nip05.description')}
                      type="email"
                    />

                    <TextField
                      control={form.control}
                      name="lud16"
                      label={t('editProfile.advanced.lud16.label')}
                      placeholder={t('editProfile.advanced.lud16.placeholder')}
                      description={t('editProfile.advanced.lud16.description')}
                      type="email"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      {t('editProfile.advanced.accountType.title')}
                    </div>
                    <SwitchField
                      control={form.control}
                      name="bot"
                      label={t('editProfile.advanced.bot.label')}
                      description={t('editProfile.advanced.bot.description')}
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
            loadingText={t('editProfile.actions.saving')}
          >
            {t('editProfile.actions.save')}
          </LoadingButton>

          {onSuccess && (
            <LoadingButton
              type="button"
              variant="outline"
              onClick={onSuccess}
              className="flex-1 sm:flex-none"
              disabled={isPending || isUploading}
            >
              {t('editProfile.actions.cancel')}
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