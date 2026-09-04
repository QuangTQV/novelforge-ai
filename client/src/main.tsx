import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "highlight.js/styles/github.css";
// i18n 必须在任何组件渲染前初始化 / i18n phải được khởi tạo trước khi render component / i18n must init before any component renders
import "./i18n";
import { LanguageProvider } from "./i18n/LanguageProvider";
import DesktopBootstrapBoundary from "./components/layout/DesktopBootstrapBoundary";
import ServerStartupGate from "./components/layout/ServerStartupGate";
import { APP_RUNTIME } from "./lib/constants";
import AppRouter from "./router";
import { Toaster } from "./components/ui/toast";
import "./index.css";
import { ThemeProvider } from "./components/theme/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppRouterProvider = APP_RUNTIME === "desktop" ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AppRouterProvider>
          <DesktopBootstrapBoundary>
            <ServerStartupGate>
              <AppRouter />
            </ServerStartupGate>
          </DesktopBootstrapBoundary>
          <Toaster />
        </AppRouterProvider>
      </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
