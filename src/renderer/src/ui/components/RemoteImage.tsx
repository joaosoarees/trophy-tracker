import { type ReactNode, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@ui/primitives/avatar';
import { Skeleton } from '@ui/primitives/skeleton';
import { cn } from '@ui/utils/cn';

interface IRemoteImageProps {
  src: string | undefined;
  /** Drawn in place of the image when it cannot be loaded. */
  fallback: ReactNode;
  /** Size and shape of the box; the image fills it. */
  className?: string;
  /** Pulse while loading. Turn off for decorative images such as backgrounds. */
  hasSkeleton?: boolean;
}

/**
 * An image from the network in a fixed box: a skeleton while it loads, the
 * fallback if it fails. Each instance tracks its own load, so one image that
 * fails or lags never affects the others.
 */
export function RemoteImage({
  src,
  fallback,
  className,
  hasSkeleton = true,
}: IRemoteImageProps) {
  const [hasFailed, setHasFailed] = useState(!src);

  return (
    <Avatar className={cn('size-auto rounded-md', className)}>
      <AvatarImage
        src={src || undefined}
        alt=""
        className="animate-fade-in aspect-auto object-cover"
        onLoadingStatusChange={(status) => setHasFailed(status === 'error')}
      />
      <AvatarFallback className="rounded-[inherit]">
        {hasFailed
          ? fallback
          : hasSkeleton && <Skeleton className="size-full rounded-none" />}
      </AvatarFallback>
    </Avatar>
  );
}
