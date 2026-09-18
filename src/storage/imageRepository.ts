import type { ImageAsset } from '@/api/types'
import { IMAGE_DB, IMAGE_STORE } from '@/config/constants'
import { createId } from '@/shared/lib/id'

let dbPromise: Promise<IDBDatabase> | null = null

function imageDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('이 브라우저에서 이미지 저장소를 사용할 수 없습니다.'))
        return
      }
      const request = indexedDB.open(IMAGE_DB, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE, { keyPath: 'id' })
      request.onerror = () => reject(request.error ?? new Error('이미지 저장소를 열 수 없습니다.'))
      request.onblocked = () => reject(new Error('다른 스튜디오 탭을 닫고 다시 열어주세요.'))
      request.onsuccess = () => resolve(request.result)
    })
  }
  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await imageDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, mode)
    const store = tx.objectStore(IMAGE_STORE)
    const request = run(store)
    tx.oncomplete = () => resolve(request?.result as T)
    tx.onerror = () => reject(tx.error || new Error('이미지 저장 실패'))
    tx.onabort = () => reject(tx.error || new Error('이미지 저장이 취소되었습니다.'))
  })
}

export const imageRepository = {
  getAll() {
    return withStore<ImageAsset[]>('readonly', (store) => store.getAll())
  },
  put(asset: ImageAsset) {
    return withStore('readwrite', (store) => store.put(asset))
  },
  putMany(assets: ImageAsset[]) {
    return withStore('readwrite', (store) => {
      for (const asset of assets) store.put(asset)
    })
  },
  delete(id: string) {
    return withStore('readwrite', (store) => store.delete(id))
  },
}

export async function rememberImage(
  file: Blob,
  reference: string,
  track: ImageAsset['track'],
  projectId: string,
  name?: string,
) {
  const all = await imageRepository.getAll()
  const existing = all.find((asset) => asset.project_id === projectId && asset.reference === reference)
  await imageRepository.put({
    id: existing?.id || createId('image'),
    project_id: projectId,
    name: name || (file instanceof File ? file.name : 'reference-image'),
    type: file.type,
    size: file.size,
    created_at: existing?.created_at || new Date().toISOString(),
    reference,
    track,
    blob: file,
  })
}
