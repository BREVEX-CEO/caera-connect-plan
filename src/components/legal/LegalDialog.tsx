/**
 * Terms and Privacy, opened without leaving the page you are on.
 *
 * WHY THIS EXISTS. The signup form linked to `/terms` and `/privacy` with a
 * router `<Link>`. Following one navigated away from the form, and everything
 * typed into it — email, password, the lot — was gone on the way back.
 * Reading the terms before agreeing to them is the one thing a person is most
 * likely to do at exactly that moment, and it was the one thing that punished
 * them for doing it.
 *
 * The dialog primitive already in this repository gives focus trapping, an
 * Escape handler, an overlay click and a labelled close control. What it does
 * not give is a body that scrolls on a phone while the header stays put, which
 * is what makes a long legal document readable on a small screen, so that is
 * added here.
 *
 * The words come from `LegalContent`, the same module the standalone routes
 * render, so the dialog cannot show a different version of the agreement from
 * the page a link would reach.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TermsContent, PrivacyContent, TERMS_META, PRIVACY_META } from "./LegalContent";

export type LegalDocument = "terms" | "privacy";

export function LegalDialog({
  open,
  document,
  onOpenChange,
}: {
  open: boolean;
  document: LegalDocument;
  onOpenChange: (open: boolean) => void;
}) {
  const meta = document === "terms" ? TERMS_META : PRIVACY_META;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /*
         * Sized in viewport units rather than a fixed height: a legal document
         * on a 667px phone and on a 1440px desktop need different amounts of
         * room, and a fixed height produces either a cramped box or one that
         * runs off the bottom of the screen with no way to reach the close
         * control.
         */
        className="flex max-h-[85vh] w-[min(46rem,calc(100vw-2rem))] flex-col gap-0 p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {meta.eyebrow}
          </p>
          <DialogTitle className="text-base">{meta.title}</DialogTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">{meta.summary}</p>
        </DialogHeader>
        {/*
          `tabIndex={0}` so the scrollable region is reachable by keyboard.
          Without it a keyboard user can focus the close button and nothing
          else, which on a document this long means they cannot read it.
        */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm"
          tabIndex={0}
          role="region"
          aria-label={`${meta.title} content`}
        >
          {document === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
