declare module 'next/types.js' {
  export type ResolvingMetadata = Promise<import('next').Metadata | undefined>;
  export type ResolvingViewport = Promise<import('next').Viewport | undefined>;
}
