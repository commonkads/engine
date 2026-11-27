/** Content and version identifier returned by `IStorageBackend.readWithVersion`. */
export interface FileContent {
  content: string;
  version: string;
}
