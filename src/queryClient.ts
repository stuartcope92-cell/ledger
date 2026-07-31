// Single shared QueryClient — used both by the <QueryClientProvider> in
// main.tsx and by store.ts's plain (non-hook) mutation functions, which
// need to call invalidateQueries() outside of any component.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();
