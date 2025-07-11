import { BlurredImage } from "@/components/BlurredImage";

interface LogTextProps {
  text: string;
}

const IMAGE_REGEX = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/gi;

export function LogText({ text }: LogTextProps) {
  const parts = text.split(IMAGE_REGEX);

  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.match(IMAGE_REGEX)) {
          return (
            <BlurredImage
              key={index}
              src={part}
              alt="log image"
              className="rounded w-full h-32 object-cover"
              onClick={() => window.open(part, "_blank")}
              blurIntensity="medium"
              defaultBlurred={true}
            />
          );
        }
        return part;
      })}
    </p>
  );
}
