export function hostMatch(store: { url: string }): string;

export function buildManifest(
  stores: { url: string; strategy?: string }[],
  version: string
): {
  version: string;
  description: string;
  permissions: string[];
  host_permissions: string[];
  content_scripts: { matches: string[]; js: string[]; run_at: string; world: string }[];
  web_accessible_resources: { matches: string[] }[];
};
