import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/PageHeader";
import { CodeWorkspacePanel } from "@/components/ocade/CodeWorkspacePanel";
import { FileManagerPanel } from "@/components/ocade/FileManagerPanel";

export const Route = createFileRoute("/_authenticated/ocade/code")({
  head: () => ({
    meta: [{ title: "OCADE Code — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: CodePage,
});

function CodePage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Code"
        description="Inspect a user-selected repository, follow its rules, patch exact context, exercise recovery, and keep observed evidence."
      />
      <CodeWorkspacePanel />
      {/* Real file operations, confined to a folder the user names. */}
      <FileManagerPanel />
    </>
  );
}
