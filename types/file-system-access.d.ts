// Minimal ambient declarations for the File System Access API. lib.dom (TS 5.9)
// already declares FileSystemHandle / FileSystemFileHandle / FileSystemDirectoryHandle
// and PermissionState, but not the picker entry points, the per-handle permission
// methods, or the directory async iterator. @types/wicg-file-system-access is
// intentionally not installed, so we augment only what this app calls — every
// addition is optional so callers must still guard for unsupported browsers.

export {}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite"
}

interface OpenFilePickerOptions {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  types?: { description?: string; accept: Record<string, string[]> }[]
}

interface DirectoryPickerOptions {
  id?: string
  mode?: "read" | "readwrite"
}

declare global {
  interface FileSystemHandle {
    queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }

  interface FileSystemDirectoryHandle {
    values?(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  }

  interface Window {
    showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
    showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
  }
}
