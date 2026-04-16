import type { SourceProvider, Chapter, ChapterImage } from './provider.interface.js';

const FOLDER_URL_REGEX = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/;

export function extractFolderId(url: string): string | null {
  const match = url.match(FOLDER_URL_REGEX);
  return match?.[1] ?? null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

export class GoogleDriveProvider implements SourceProvider {
  name = 'google-drive';

  constructor(private apiKey: string) {}

  canHandle(url: string): boolean {
    return extractFolderId(url) !== null;
  }

  async parseChapter(url: string): Promise<Chapter> {
    const folderId = extractFolderId(url);
    if (!folderId) throw new Error(`Invalid Google Drive folder URL: ${url}`);

    const files = await this.listImageFiles(folderId);

    // Sort by name to maintain page order (numeric sort for "001.jpg", "002.jpg", etc.)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const images: ChapterImage[] = files.map((file, index) => ({
      index,
      originalUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
      proxyUrl: `/api/images/${folderId}-${index}`,
    }));

    return {
      chapterId: folderId,
      provider: this.name,
      images,
      totalPages: images.length,
    };
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const url = `https://drive.google.com/uc?export=download&id=${imageRef}`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  private async listImageFiles(folderId: string): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and mimeType contains 'image/'`,
        key: this.apiKey,
        fields: 'files(id,name,mimeType),nextPageToken',
        pageSize: '1000',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status} ${await response.text()}`);
      }

      const data: DriveListResponse = await response.json() as DriveListResponse;
      allFiles.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return allFiles;
  }
}
