// Runs async jobs one at a time in submission order. A failed job rejects its
// own caller only; the jobs queued after it still run.
export const createSerialQueue = () => {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const next = tail.then(job, job);
    tail = next.catch(() => undefined);
    return next;
  };
};
