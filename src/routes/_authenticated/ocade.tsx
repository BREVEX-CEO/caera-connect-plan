import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";

/**
 * One shell for every OCADE screen.
 *
 * Pages used to wrap themselves in `AppShell` individually, so any page that
 * forgot lost the sidebar, top bar and module rail entirely. The layout owns
 * the chrome now; children render page content only.
 */
export const Route = createFileRoute("/_authenticated/ocade")({
  component: OcadeLayout,
});

function OcadeLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
