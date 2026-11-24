/** Content and version identifier returned by `IFileStore.readWithVersion`. */
export interface FileContent {
  content: string;
  version: string;
}
