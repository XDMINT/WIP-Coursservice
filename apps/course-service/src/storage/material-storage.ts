import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

import { ApiValidationError } from '../common/api-errors';

export type StoredMaterialFile = {
  storageKey: string;
  safeFileName: string;
};

export type MaterialDownloadFile = {
  stream: Readable;
  absolutePath: string;
};

export interface MaterialStorage {
  saveFile(courseId: string, originalFileName: string, buffer: Buffer): Promise<StoredMaterialFile>;
  openFile(courseId: string, storageKey: string): MaterialDownloadFile;
  deleteFile(courseId: string, storageKey?: string): Promise<void>;
}

const fallbackStoragePath = () => resolve(process.cwd(), 'storage', 'materials');

@Injectable()
export class LocalMaterialStorage implements MaterialStorage {
  private readonly basePath = resolve(
    process.env.COURSE_MATERIAL_STORAGE_PATH ?? fallbackStoragePath(),
  );

  sanitizeFileName(originalFileName: string): string {
    const cleanBaseName = basename(originalFileName || 'material')
      .normalize('NFKD')
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return cleanBaseName || 'material';
  }

  async saveFile(
    courseId: string,
    originalFileName: string,
    buffer: Buffer,
  ): Promise<StoredMaterialFile> {
    const safeFileName = this.sanitizeFileName(originalFileName);
    const extension = extname(safeFileName).toLowerCase();
    const storageKey = `${randomUUID()}${extension}`;
    const courseDirectory = this.resolveCourseDirectory(courseId);
    const targetPath = this.resolveFilePath(courseId, storageKey);

    await mkdir(courseDirectory, { recursive: true });
    await writeFile(targetPath, buffer);

    return {
      storageKey,
      safeFileName,
    };
  }

  openFile(courseId: string, storageKey: string): MaterialDownloadFile {
    const absolutePath = this.resolveFilePath(courseId, storageKey);

    return {
      absolutePath,
      stream: createReadStream(absolutePath),
    };
  }

  async deleteFile(courseId: string, storageKey?: string): Promise<void> {
    if (!storageKey) {
      return;
    }

    try {
      await unlink(this.resolveFilePath(courseId, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private resolveCourseDirectory(courseId: string): string {
    return this.assertInsideBasePath(resolve(this.basePath, courseId));
  }

  private resolveFilePath(courseId: string, storageKey: string): string {
    if (storageKey.includes('/') || storageKey.includes('\\') || storageKey.includes('..')) {
      throw new ApiValidationError('Invalid storage key');
    }

    return this.assertInsideBasePath(resolve(join(this.basePath, courseId, storageKey)));
  }

  private assertInsideBasePath(targetPath: string): string {
    const relativePrefix = `${this.basePath}/`;

    if (targetPath !== this.basePath && !targetPath.startsWith(relativePrefix)) {
      throw new ApiValidationError('Invalid storage path');
    }

    return targetPath;
  }
}
