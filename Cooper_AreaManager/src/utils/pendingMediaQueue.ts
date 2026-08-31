import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { devLog } from './devLog';

// Durable, cross-restart counterpart to offlineQueue.ts — that one only
// ever stores small JSON bodies (cheap to keep in AsyncStorage forever);
// a picked photo/video/PDF is a multi-MB binary sitting at a URI the OS
// itself owns (ImagePicker/DocumentPicker's cache directory), which can be
// evicted at any time under storage pressure with zero warning. So a
// network failure here does two things: copies the file into this app's
// own document directory (Paths.document — explicitly NOT evictable by the
// OS, unlike Paths.cache) so it survives even if the original picked file's
// location gets cleared, then records just the metadata + that new
// permanent path here. mediaSyncEngine.ts is what actually replays this
// queue.
const QUEUE_KEY = 'cc_media_queue';
const pendingDir = new Directory(Paths.document, 'pending-uploads');

export type PendingMediaItem = {
  id: string;
  createdAt: number;
  formKind: 'commissioning' | 'service';
  taskId: string;
  // Which local list this lands in once uploaded — mirrors
  // useTaskFormPhotos.ts's two lists; the SR form only ever uses 'site'.
  target: 'site' | 'runningHours';
  mediaKind: 'photo' | 'video' | 'pdf';
  fileUri: string;
  fileName: string;
  fileSize?: number;
};

async function readQueue(): Promise<PendingMediaItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    devLog('[Media Queue] Failed to read queue:', error);
    return [];
  }
}

async function writeQueue(queue: PendingMediaItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function ensurePendingDir() {
  if (!pendingDir.exists) pendingDir.create({ intermediates: true });
}

// Copies the picked file into permanent storage and records it. Called
// only once a network failure is actually confirmed (not on every upload
// attempt) — the common case, a successful immediate upload, never touches
// disk twice for nothing.
export async function enqueuePendingMedia(
  item: Omit<PendingMediaItem, 'id' | 'createdAt' | 'fileUri'> & { sourceUri: string }
): Promise<PendingMediaItem> {
  ensurePendingDir();
  const ext = item.fileName.includes('.') ? item.fileName.split('.').pop() : 'dat';
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const destination = new File(pendingDir, `${id}.${ext}`);
  const source = new File(item.sourceUri);
  await source.copy(destination);

  const { sourceUri, ...rest } = item;
  const entry: PendingMediaItem = { ...rest, id, createdAt: Date.now(), fileUri: destination.uri };
  const queue = await readQueue();
  queue.push(entry);
  await writeQueue(queue);
  return entry;
}

export async function getPendingMediaQueue(): Promise<PendingMediaItem[]> {
  return readQueue();
}

export async function getPendingMediaCount(): Promise<number> {
  return (await readQueue()).length;
}

// Removes both the queue entry and its permanent on-disk copy — used both
// when an upload finally succeeds and when the server rejects it outright
// (a real error, not a network one, isn't worth retrying forever).
export async function removePendingMedia(id: string): Promise<void> {
  const queue = await readQueue();
  const match = queue.find((entry) => entry.id === id);
  await writeQueue(queue.filter((entry) => entry.id !== id));
  if (match) {
    try {
      new File(match.fileUri).delete();
    } catch (error) {
      devLog('[Media Queue] Failed to delete on-disk copy:', error);
    }
  }
}
