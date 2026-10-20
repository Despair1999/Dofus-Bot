/** Serialize asynchronous native transitions so the last requested mode wins. */
export function createSerialQueue() {
  let tail = Promise.resolve();
  return (task: () => Promise<void>) => {
    const current = tail.then(task);
    tail = current.catch(() => {});
    return current;
  };
}
