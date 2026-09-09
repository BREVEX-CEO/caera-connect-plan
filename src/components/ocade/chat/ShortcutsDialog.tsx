import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHAT_SHORTCUTS } from "@/lib/chat-shortcuts";

/**
 * The shortcut sheet.
 *
 * Read from `CHAT_SHORTCUTS` rather than written out again here, so a binding
 * cannot exist without appearing on this list — an undiscoverable keyboard
 * shortcut is, for almost every user, the same as one that was never built.
 */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="mt-1 space-y-2">
          {CHAT_SHORTCUTS.map((entry) => (
            <li key={entry.action} className="flex items-center justify-between gap-4 text-[13px]">
              <span className="text-muted-foreground">{entry.description}</span>
              <span className="flex shrink-0 items-center gap-1">
                {entry.keys.map((cap) => (
                  <kbd
                    key={cap}
                    className="rounded border border-border/70 bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {cap}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-muted-foreground">
          On a Mac, use Command wherever Ctrl is shown.
        </p>
      </DialogContent>
    </Dialog>
  );
}
