# Control Engine Provenance Review

Status: **OPEN — blocks commercial distribution of the control-engine bundle**

Legal review required. This is an engineering record, not legal advice.

## Finding

Repository history shows that a legacy control-engine tree and its README were
introduced from or modelled on `FatihMakes/Mark-L`. The upstream README states
that the work is for personal and non-commercial use under CC BY-NC 4.0. OCADE
is intended to be a paid commercial product, so attribution alone is not enough
to clear that conflict.

The current product path has since been substantially reworked around OCADE's
signed bridge, UI Automation observation, approval policy, receipts, emergency
stop, local Ollama routing and a separate managed-browser host. That technical
evolution does not by itself prove that every surviving line is independently
owned.

## Required closure before a paid release

- Produce a file-by-file provenance inventory for
  `native/ocade_control_engine` using Git history and upstream comparison.
- Remove and clean-room replace any surviving non-commercial source, or obtain
  written commercial permission from the upstream rights holder.
- Preserve applicable notices for third-party code that is permitted to ship.
- Have an IP lawyer review the resulting inventory and release boundary.
- Record the reviewer, date, reviewed commit and decision in this file.

## Current engineering restriction

No new Mark-L code, prompts, artwork or documentation may be copied into OCADE.
General ideas such as accessibility-tree grounding are not copied source code;
implementations must be original and independently tested.
