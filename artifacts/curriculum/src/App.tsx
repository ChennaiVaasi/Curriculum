import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UploadProvider } from "@/context/UploadContext";
import { SiteShell } from "@/components/SiteShell";
import HomePage from "@/pages/HomePage";
import LibraryPage from "@/pages/LibraryPage";
import BookPage from "@/pages/BookPage";
import ChapterPage from "@/pages/ChapterPage";
import NotebookPage from "@/pages/NotebookPage";
import UploadPage from "@/pages/UploadPage";
import PgnTaxonomyPage from "@/pages/PgnTaxonomyPage";
import PdfTaxonomyPage from "@/pages/PdfTaxonomyPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <SiteShell>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/library" component={LibraryPage} />
        <Route path="/books/:bookId" component={BookPage} />
        <Route path="/chapters/:chapterId" component={ChapterPage} />
        <Route path="/notebook" component={NotebookPage} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/pgn-taxonomy" component={PgnTaxonomyPage} />
        <Route path="/pdf-taxonomy" component={PdfTaxonomyPage} />
        <Route component={NotFound} />
      </Switch>
    </SiteShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UploadProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </UploadProvider>
    </QueryClientProvider>
  );
}

export default App;
