// Response readers that never throw: a body that is missing or not JSON is a
// normal outcome for the store APIs and is handled by the caller.

export const readJson = (response: Response): Promise<unknown> =>
  response.json().catch(() => null);

export const readText = (response: Response): Promise<string> =>
  response.text().catch(() => "");

export const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const isSuccess = (status: number) => status >= 200 && status < 300;
