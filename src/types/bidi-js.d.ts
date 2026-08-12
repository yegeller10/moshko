declare module "bidi-js" {
  type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  };

  type Bidi = {
    getEmbeddingLevels: (
      string: string,
      explicitLevel?: number | "ltr" | "rtl" | null,
    ) => EmbeddingLevels;
    getReorderedString: (
      string: string,
      embeddingLevels: EmbeddingLevels,
      start?: number | null,
      end?: number | null,
    ) => string;
  };

  export default function bidiFactory(): Bidi;
}
