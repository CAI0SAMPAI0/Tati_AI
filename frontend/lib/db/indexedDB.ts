import type { Message } from '@/lib/api/types';

const DB_NAME = 'tati_ai_local_db';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in browser environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('conversation_id', 'conversation_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

export async function saveMessagesLocal(conversationId: string, messages: Message[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      messages.forEach((msg) => {
        const item = {
          ...msg,
          conversation_id: conversationId,
        };
        store.put(item);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error saving messages locally:', err);
  }
}

export async function getMessagesLocal(conversationId: string): Promise<Message[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('conversation_id');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const msgs = request.result as Message[];
        msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        resolve(msgs);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting local messages:', err);
    return [];
  }
}

export async function clearMessagesLocal(conversationId: string): Promise<void> {
  try {
    const db = await getDB();
    const msgs = await getMessagesLocal(conversationId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      msgs.forEach((msg) => {
        store.delete(msg.id);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error clearing local messages:', err);
  }
}
