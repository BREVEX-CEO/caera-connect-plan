/**
 * Local Intelligence — what is running on this device, and how healthy it is.
 *
 * WHAT THIS PAGE USED TO BE. 874 lines of cloud-provider configuration:
 * routing modes across four providers, privacy/cost/speed preference matrices,
 * "Test connection" buttons for the Lovable AI Gateway and OpenAI, a model
 * fabric listing hosted models, and usage diagnostics for a cloud allowance.
 * Roughly forty lines of it concerned the engine that actually answers.
 *
 * Every one of those controls saved a value that no longer changes anything,
 * because OCADE does not use a hosted provider. A settings screen whose
 * switches persist and do nothing is worse than no settings screen: it tells
 * the user they are in control of something they are not.
 *
 * So the page is now about the only engine there is. The local lifecycle
 * panel and the engine control were already here and already good; they are
 * what is left, plus an honest statement of where generation happens.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { ocadeIntro } from "@/lib/ocade-identity";
import { LocalModelLifecyclePanel } from "@/components/ocade/LocalModelLifecyclePanel";
import { LocalEngineControl } from "@/components/ocade/LocalEngineControl";

export const Route = createFileRoute("/_authenticated/ocade/models")({
  component: OcadeModelsPage,
});

function OcadeModelsPage() {
  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <PageHeader
        title="Local Intelligence"
        description="The engine that answers you runs on this device. Nothing here sends your conversations anywhere."
        actions={
          <Link
            to="/ocade"
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" /> Back to chat
          </Link>
        }
      />

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 pb-16">
        <GlassPanel className="p-5">
          {/*
            Start/stop comes BEFORE the lifecycle panel because it is the
            prerequisite: installing or activating a model against a runtime
            that is not listening fails for a reason the user cannot see from
            the download UI.
          */}
          <LocalEngineControl />
          <div className="mt-5" />
          <LocalModelLifecyclePanel />
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
            <div className="text-sm text-fg-muted">
              <p className="font-medium text-fg">Where your words go</p>
              <p className="mt-1">
                OCADE generates every reply on this device. Your messages, drafts, attachments and
                the reasoning behind an answer are not sent to OpenAI, Google, Anthropic or any
                other AI service — there is no code left in OCADE that can reach one.
              </p>
              <p className="mt-2">
                OCADE still uses the internet for ordinary things: downloading its own engine the
                first time, looking up current information when a question needs it, and
                synchronising your chats if you have chosen to. Fetching a fact is not the same as
                handing over your thinking, and OCADE only does the first.
              </p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-accent" />
            <div className="text-sm text-fg-muted">
              <p className="font-medium text-fg">Identity</p>
              <p className="mt-1">
                In conversation OCADE introduces itself as{" "}
                <span className="text-fg">{ocadeIntro()}</span> and refers to its engine by
                capability rather than by file name. Asked directly which engine is answering, it
                answers truthfully — the details stay on this page rather than in every reply.
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
