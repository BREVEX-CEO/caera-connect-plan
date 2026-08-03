import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { SettingsShell } from "@/components/settings/SettingsShell";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <AppShellNoPad>
      <SettingsShell>
        <Outlet />
      </SettingsShell>
    </AppShellNoPad>
  );
}

// AppShell wraps content in a max-w-5xl padded container. The settings
// workspace supplies its own two-column layout, so we render inside a
// full-bleed variant of AppShell by neutralising the wrapper padding.
function AppShellNoPad({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="-mx-6 -my-8 sm:-mx-10">{children}</div>
    </AppShell>
  );
}
