import { useId } from "react";
import { Play } from "lucide-react";
import { copyExternalLinkToClipboard } from "@/lib/external-link-copy";
import { cn } from "@/lib/utils";

interface Props {
  platform: string;
  url?: string | null;
  className?: string;
}

const labelFor = (platform: string) => {
  const value = platform.toLowerCase();
  if (value.includes("insta")) return "Instagram";
  if (value.includes("short")) return "YouTube Shorts";
  if (value.includes("you") || value.includes("yt")) return "YouTube";
  return platform || "platform";
};

const YouTubeLogo = ({ shorts = false }: { shorts?: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill={shorts ? "#3B82F6" : "#FF0000"} aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const InstagramLogo = () => {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: "#feda75" }} />
          <stop offset="25%" style={{ stopColor: "#fa7e1e" }} />
          <stop offset="50%" style={{ stopColor: "#d62976" }} />
          <stop offset="75%" style={{ stopColor: "#962fbf" }} />
          <stop offset="100%" style={{ stopColor: "#4f5bd5" }} />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradientId})`} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
};

const Logo = ({ platform }: { platform: string }) => {
  const value = platform.toLowerCase();
  if (value.includes("insta")) return <InstagramLogo />;
  if (value.includes("short")) return <YouTubeLogo shorts />;
  if (value.includes("you") || value.includes("yt")) return <YouTubeLogo />;
  return <Play className="h-5 w-5 text-primary" />;
};

export const PlatformLinkIcon = ({ platform, url, className }: Props) => {
  const label = labelFor(platform);
  const content = <Logo platform={platform} />;

  if (!url) {
    return (
      <span className={cn("inline-flex h-8 w-8 items-center justify-center opacity-30", className)} title={`No ${label} link`} aria-label={`No ${label} link`}>
        {content}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => copyExternalLinkToClipboard(url)}
      title={`Open on ${label}`}
      aria-label={`Open on ${label}`}
      className={cn("inline-flex h-8 w-8 items-center justify-center opacity-70 transition-opacity hover:opacity-100", className)}
    >
      {content}
    </a>
  );
};
