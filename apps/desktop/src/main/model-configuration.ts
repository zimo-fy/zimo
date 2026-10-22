export function canEditManagedModel(options: {
  packaged: boolean;
  rendererUrl?: string | undefined;
}): boolean {
  return !options.packaged && Boolean(options.rendererUrl);
}
