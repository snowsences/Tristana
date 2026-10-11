const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);});
const database = new Promise((resolve,reject)=>{
  const r=indexedDB.open('tristana',1);
  r.onupgradeneeded=()=>{for(const name of ['entries','photos','settings','history']) r.result.createObjectStore(name,{keyPath:'key'});};
  r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
});
export async function get(store,key) { const db=await database; return request(db.transaction(store).objectStore(store).get(key)); }
export async function all(store) { const db=await database; return request(db.transaction(store).objectStore(store).getAll()); }
export async function put(store,value) {
  const db=await database;
  return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
export async function remove(store,key) {
  const db=await database;
  return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
}
export async function entriesFor(uid) { return (await all('entries')).filter(x=>x.key.startsWith(uid+':')); }
export async function persistStorage() { try {return await navigator.storage?.persist?.();} catch {return false;} }
