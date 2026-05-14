import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Image as ImageIcon, X, Loader2, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateGoodDeed } from "@/hooks/useCreateGoodDeed";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";
import { buildImetaTag } from "@/utils/nip-gd";

interface GoodDeedFormProps {
  geocache: {
    name?: string;
    dTag: string;
    pubkey: string;
    kind?: number;
  };
  /** The Key Quest mission text, echoed in the form header for context. */
  mission?: string;
  compact?: boolean;
  className?: string;
}

interface AttachedImage {
  /** Object URL or hosted URL for previewing. */
  previewUrl: string;
  /** Raw NIP-94/Blossom tag list from useUploadFile. */
  uploadTags: string[][];
}

/**
 * Submission form for a NIP-GD Good Deed (kind 5777) that claims completion
 * of a treasure's Key Quest. Renders in place of the locked log form when
 * the treasure has a `mission` tag and the visitor does not have the
 * verification link.
 */
export function GoodDeedForm({
  geocache,
  mission,
  compact = false,
  className,
}: GoodDeedFormProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutate: createGoodDeed, isPending } = useCreateGoodDeed();

  const [content, setContent] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user) {
      toast({
        title: t("goodDeed.errors.loginRequired.title"),
        description: t("goodDeed.errors.loginRequired.description"),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadTags = await uploadFile(file);
      const url = uploadTags[0]?.[1];
      if (!url) {
        throw new Error("Upload returned no URL.");
      }
      setImages((prev) => [...prev, { previewUrl: url, uploadTags }]);
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: t("goodDeed.errors.uploadFailed.title"),
        description: errorObj.message || t("goodDeed.errors.uploadFailed.description"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!user) {
      toast({
        title: t("goodDeed.errors.loginRequired.title"),
        description: t("goodDeed.errors.loginRequired.description"),
        variant: "destructive",
      });
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      toast({
        title: t("goodDeed.errors.contentRequired.title"),
        description: t("goodDeed.errors.contentRequired.description"),
        variant: "destructive",
      });
      return;
    }

    // Build NIP-92 imeta tags for every attached image. NIP-GD requires
    // imeta for media; no legacy `image` tag fallback.
    const imeta: string[][] = [];
    for (const img of images) {
      const tag = buildImetaTag(img.uploadTags);
      if (tag) imeta.push(tag);
    }

    createGoodDeed(
      {
        content: trimmed,
        geocache: {
          pubkey: geocache.pubkey,
          dTag: geocache.dTag,
          kind: geocache.kind,
        },
        imeta,
        categories: ["quest"],
      },
      {
        onSuccess: () => {
          setContent("");
          setImages([]);
        },
      },
    );
  };

  const submitDisabled = isPending || isUploading || !user || !content.trim();

  return (
    <div
      data-good-deed-form
      className={
        `rounded-lg border border-primary/30 bg-card shadow-sm overflow-hidden ${className ?? ""}`
      }
    >
      {/* Header */}
      <div className="border-b border-primary/10 bg-primary/[0.03] px-4 py-4 md:px-5 md:py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground leading-snug">
              {t("goodDeed.title")}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("goodDeed.description")}
            </p>
            {mission && (
              <p className="mt-2 text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary mr-1">
                  {t("cacheDetail.mission.label")}:
                </span>
                {mission}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className={compact ? "p-4 space-y-3" : "p-4 md:p-5 space-y-4"}>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("goodDeed.placeholder")}
          rows={compact ? 3 : 4}
          className={compact ? "text-sm" : ""}
          disabled={isPending}
        />

        {/* Image attachments */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div
                key={`${img.previewUrl}-${i}`}
                className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted"
              >
                <img
                  src={img.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 rounded-full bg-background/80 hover:bg-background p-1 text-foreground shadow-sm"
                  aria-label={t("goodDeed.image.remove")}
                  disabled={isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isPending || !user}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4 mr-2" />
            )}
            {t("goodDeed.image.add")}
          </Button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitDisabled}
          size={compact ? "sm" : "default"}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isPending ? t("goodDeed.posting") : t("goodDeed.submit")}
        </Button>

        <p className="text-xs text-muted-foreground">
          {t("goodDeed.disclaimer")}
        </p>
      </div>
    </div>
  );
}
