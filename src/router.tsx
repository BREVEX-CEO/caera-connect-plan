import "./lib/zod-jitless"; // first: before any zod schema is built
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { requestNonce } from "./lib/security/csp-nonce";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The request's CSP nonce, on the server only; the router puts it on its inline scripts.
    ssr: { nonce: requestNonce() },
  });

  return router;
};
