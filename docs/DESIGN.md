# OCADE Design System

## References

Primary structural reference:

- `docs/design-references/grok/` — sole visual reference set for layout, density, spacing, sidebar/top-bar/settings proportions and overall simplicity.
- `docs/UI_REFERENCE_CHECKLIST.md` — lightweight production UI checklist.

The former Stitch/Jarvis 3D reference is removed and must not be treated as a design source. Cowork and Jarvis use the same simplified OCADE visual language derived from the Grok reference set.

References are not source code or a license to copy proprietary assets/text/trade dress. Build original OCADE components.

## Palette

Default dark surface family:

- canvas: near black;
- raised/glass surfaces: near-black with low alpha/transparency;
- primary text: soft white;
- secondary text: neutral grey;
- border: low-contrast grey/white alpha;
- selected/hover: subtle luminance change;
- danger: semantic red only;
- success: semantic success treatment only where real state is verified.

Keep the ordinary UI neutral. Brand color is restrained.

## Glass

Use light glassmorphism, not glass-card walls:

- slight transparency;
- modest backdrop blur where supported;
- one thin border;
- tiny inner/highlight edge;
- very low or no shadow.

Disable/reduce blur when it harms performance or contrast.

## Geometry

- small/medium radius;
- avoid giant rounded rectangles;
- buttons compact but accessible;
- primary touch targets approximately 44px where practical;
- layout uses spacing rather than borders to separate most content.

## Typography

Keep the existing efficient interface font stack unless removal of a dependency makes the system stack smaller without visual regression.

- short headings;
- normal readable body;
- muted supporting copy;
- monospace only for genuinely technical/Advanced content.

## Shell

Desktop:

- fixed/narrow left sidebar;
- optional compact top bar;
- large main workspace;
- Account at bottom left;
- Settings as centered panel.

Mobile:

- sidebar becomes drawer;
- settings becomes full-height sheet;
- composers respect keyboard and safe-area.

## Components

Prefer:

- simple row/list;
- menu;
- compact segmented control;
- minimal input/composer;
- modal/sheet;
- skeleton;
- toast;
- contextual detail drawer.

Avoid:

- permanent status-card grids;
- repeated badges/pills;
- explanatory paragraphs beside every control;
- duplicate buttons for the same action;
- decorative technical telemetry.

## Chat composer

One visual anchor. Default visible actions: attachment, microphone, send. Intelligence selector is compact and optional. Project/tool/incognito-like advanced options, if retained at all, belong behind a contextual menu rather than equal visual weight.

## Cowork

Normal mode shares Chat's composer language. Runtime progress is a short list, not a dashboard.

Jarvis is the voice-first/hands-free mode inside Cowork and follows the same simplified shell. Use only a small original OCADE audio/orb indicator where useful. Listening/thinking/speaking/working states may animate subtly but must preserve text status and reduced-motion equivalence.

## Interaction

- hover/focus: subtle luminance/1–2 px response;
- transition: short and restrained;
- no continuous page movement;
- no cursor trails;
- keyboard focus is always visible;
- every icon-only control has an accessible name/tooltip.

## Content

Normal screens never expose raw internal model/provider/file/runtime identifiers. Keep copy user-oriented and one line when possible.
