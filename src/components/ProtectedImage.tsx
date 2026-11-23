import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getAuthToken } from '../lib/api';

interface ProtectedImageProps {
  src: string;
  alt: string;
  isPrivateAsset?: boolean;
  className?: string;
}

export const ProtectedImage: React.FC<ProtectedImageProps> = ({
  src,
  alt,
  isPrivateAsset = false,
  className = '',
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    isPrivateAsset || src.startsWith('/api/') ? null : src,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!src) {
      setFailed(true);
      return;
    }

    if (!isPrivateAsset && !src.startsWith('/api/')) {
      setResolvedSrc(src);
      setFailed(false);
      return;
    }

    const token = getAuthToken();
    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Forbidden');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, isPrivateAsset]);

  if (failed || !resolvedSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#0D1526] text-[#94A3B8] ${className}`}
      >
        <ImageOff className="w-6 h-6 mb-1.5 opacity-60" />
        <span className="text-xs px-2 text-center truncate max-w-full">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
