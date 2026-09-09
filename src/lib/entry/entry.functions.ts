/**
 * The landing-seen device flag, read from the incoming request.
 *
 * A SERVER FUNCTION RATHER THAN A SERVER MODULE, and the build is what settled
 * it. `src/routes/index.tsx` is in the browser's import graph, so importing
 * anything that reaches `@tanstack/react-start/server` from it fails the
 * client build outright — correctly, because that module cannot exist in a
 * browser. `createServerFn` is the boundary the framework provides for exactly
 * this: the handler is extracted into the server graph, and the client keeps
 * only a stub it never calls.
 *
 * IT IS NOT A ROUND TRIP. `/` resolves this during server rendering, where a
 * server function executes in process. The browser answers the same question
 * from `document.cookie` without calling anything.
 *
 * FAILS TOWARDS THE LANDING PAGE. If there is no readable request — a
 * prerender pass, a test renderer — this answers "not seen" and the visitor
 * gets the marketing page. The opposite failure would replace the public
 * landing page with a redirect shell in exactly the situation where nobody is
 * there to notice.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { hasSeenLanding } from "./root-entry";

export const landingSeenOnServer = createServerFn({ method: "GET" }).handler(() => {
  try {
    return hasSeenLanding(getRequest()?.headers.get("cookie"));
  } catch {
    return false;
  }
});
