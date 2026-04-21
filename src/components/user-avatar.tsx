"use client";

import Image from "next/image";
import { useState } from "react";

type UserAvatarProps = {
  src: string | null;
  name: string;
  email?: string;
  size?: number;
};

const DEFAULT_SRC = "/default-avatar.svg";

export function UserAvatar({ src, name, email, size = 40 }: UserAvatarProps) {
  const [imgSrc, setImgSrc] = useState<string>(src ?? DEFAULT_SRC);

  return (
    <div
      className="rounded-full border-2 border-primary/40 overflow-hidden bg-surface-container-highest flex items-center justify-center"
      style={{ width: size, height: size }}
      title={email ?? name}
    >
      <Image
        src={imgSrc}
        alt={name}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        unoptimized
        onError={() => {
          if (imgSrc !== DEFAULT_SRC) setImgSrc(DEFAULT_SRC);
        }}
      />
    </div>
  );
}
