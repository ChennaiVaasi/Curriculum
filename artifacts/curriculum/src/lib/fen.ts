export const FEN_NOTEBOOK_KEY = "fen-notebook";

export type NotebookFen = {
  id: string;
  fen: string;
  chapterId: string;
  chapterTitle: string;
  bookTitle?: string;
  sourceMessage: string;
  savedAt: string;
};

const FEN_PATTERN =
  /([prnbqkPRNBQK1-8]{1,8}(?:\/[prnbqkPRNBQK1-8]{1,8}){7}\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:[a-h][36]|-)\s+\d+\s+\d+)/g;

export function extractFens(text: string) {
  const matches = text.match(FEN_PATTERN) || [];
  return [...new Set(matches.map((entry) => entry.trim()))];
}

function escapeTagValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sanitizeComment(value: string) {
  return value.replace(/[{}]/g, "").trim();
}

export function notebookEntryToPgn(entry: NotebookFen) {
  const eventName = entry.bookTitle ? `${entry.bookTitle} - ${entry.chapterTitle}` : entry.chapterTitle;
  const date = entry.savedAt.slice(0, 10).replace(/-/g, ".");
  const sourceComment = sanitizeComment(entry.sourceMessage);

  return [
    `[Event "${escapeTagValue(eventName)}"]`,
    `[Site "Curriculum"]`,
    `[Date "${date}"]`,
    `[Round "-"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "*"]`,
    `[SetUp "1"]`,
    `[FEN "${escapeTagValue(entry.fen)}"]`,
    "",
    `{Saved from chapter chat: ${sourceComment}} *`,
  ].join("\n");
}

export function notebookToPgn(entries: NotebookFen[]) {
  return entries.map(notebookEntryToPgn).join("\n\n");
}
