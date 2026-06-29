import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type FileStatus = "pending" | "uploading" | "done" | "error";

export type FileItem = {
  id: string;
  file: File;
  name: string;
  status: FileStatus;
  progress: number;
  error?: string;
};

export type UploadMetadata = {
  bookTitle: string;
  level: string;
  theme: string;
  primarySkill: string;
  secondarySkills: string;
  notes: string;
  pgn: string;
};

export type UploadState = {
  files: FileItem[];
  metadata: UploadMetadata | null;
  isRunning: boolean;
  doneCount: number;
  errorCount: number;
};

type UploadContextValue = {
  state: UploadState;
  startUpload: (files: File[], metadata: UploadMetadata) => void;
  clearDone: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function uploadFileXhr(
  file: File,
  metadata: UploadMetadata,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set("bookTitle", metadata.bookTitle);
    body.set("level", metadata.level);
    body.set("theme", metadata.theme);
    body.set("primarySkill", metadata.primarySkill);
    body.set("secondarySkills", metadata.secondarySkills);
    body.set("notes", metadata.notes);
    body.set("pgn", metadata.pgn);
    body.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        let msg = "Upload failed.";
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed.error) msg = parsed.error;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error."));
    xhr.send(body);
  });
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>({
    files: [],
    metadata: null,
    isRunning: false,
    doneCount: 0,
    errorCount: 0,
  });

  const runningRef = useRef(false);

  const startUpload = useCallback((files: File[], metadata: UploadMetadata) => {
    if (runningRef.current) return;

    const items: FileItem[] = files.map((f) => ({
      id: makeId(),
      file: f,
      name: f.name,
      status: "pending",
      progress: 0,
    }));

    setState({
      files: items,
      metadata,
      isRunning: true,
      doneCount: 0,
      errorCount: 0,
    });

    runningRef.current = true;

    (async () => {
      let done = 0;
      let errors = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.id === item.id ? { ...f, status: "uploading", progress: 0 } : f,
          ),
        }));

        try {
          await uploadFileXhr(item.file, metadata, (pct) => {
            setState((prev) => ({
              ...prev,
              files: prev.files.map((f) =>
                f.id === item.id ? { ...f, progress: pct } : f,
              ),
            }));
          });

          done++;
          setState((prev) => ({
            ...prev,
            doneCount: done,
            files: prev.files.map((f) =>
              f.id === item.id ? { ...f, status: "done", progress: 100 } : f,
            ),
          }));
        } catch (err) {
          errors++;
          setState((prev) => ({
            ...prev,
            errorCount: errors,
            files: prev.files.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed.",
                  }
                : f,
            ),
          }));
        }
      }

      runningRef.current = false;
      setState((prev) => ({ ...prev, isRunning: false }));
    })();
  }, []);

  const clearDone = useCallback(() => {
    setState({
      files: [],
      metadata: null,
      isRunning: false,
      doneCount: 0,
      errorCount: 0,
    });
  }, []);

  return (
    <UploadContext.Provider value={{ state, startUpload, clearDone }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside UploadProvider");
  return ctx;
}
