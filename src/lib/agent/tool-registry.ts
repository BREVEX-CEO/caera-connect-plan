/**
 * Stage 2 of tool routing: the catalogue, grouped by domain.
 *
 * WHAT THE MODEL IS AND IS NOT GIVEN
 * ----------------------------------
 * Given: a small set of named, typed, purpose-shaped actions with plain-English
 * descriptions — "focus a window", "read the visible text of a window", "find
 * a file under an approved folder".
 *
 * Not given, ever: a shell, a PowerShell string, a filesystem path it chose
 * itself, raw pointer coordinates as a first resort, a CDP socket, ADB, an
 * administrator token, or a credential. Those are not omissions to be filled in
 * later. Every one of them is a capability whose safety depends on a human
 * having thought about the specific case, and a tool description is not a place
 * where thinking happens.
 *
 * Each entry names the ADAPTER that executes it. The model emits a name and
 * arguments; the adapter validates those arguments against its own rules and
 * then does the work. A tool call is a request, never an instruction.
 *
 * WHY SCHEMAS LIVE NEXT TO THEIR DOMAIN
 * -------------------------------------
 * So `schemasFor(["files"])` is the whole of the file domain and cannot
 * accidentally include a browser tool. Grouping by domain in one object is what
 * makes stage-2 loading a lookup rather than a filter someone has to maintain.
 */

import type { Domain } from "./domains";
import type { ToolOutcome } from "./outcomes";

/** JSON-schema subset the local runtimes accept for function parameters. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
      /**
       * Element shape for `type: "array"` parameters.
       *
       * Added for the office tools, which take a list of rows or paragraphs.
       * Without it the schema says only "array", and a 3B model given an
       * untyped array reliably sends a single string where a list of row
       * objects was wanted — the shape has to be in the schema, because it is
       * the only description of it the model ever sees.
       */
      items?: { type: string; description?: string };
    }
  >;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  domain: Domain;
  description: string;
  parameters: ToolParameterSchema;
  /**
   * True when running this changes something on the machine. Read-only tools
   * skip the permission prompt entirely, which is what keeps observation cheap
   * enough to do before and after every action.
   */
  mutating: boolean;
  /**
   * Risk band, used by the permission layer. `high` always requires explicit
   * confirmation regardless of the user's autonomy setting.
   */
  risk: "read" | "low" | "medium" | "high";
}

/** What an adapter must satisfy to back a tool. */
export type ToolAdapter = (
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<ToolOutcome>;

const object = (
  properties: ToolParameterSchema["properties"],
  required: string[] = [],
): ToolParameterSchema => ({ type: "object", properties, required });

const NO_ARGS = object({});

/* ------------------------------------------------------------ os_app -- */

const OS_APP: ToolDefinition[] = [
  {
    name: "screen_observe",
    domain: "os_app",
    description:
      "Look at the computer right now. Returns the active window, the list of open windows, the accessibility structure of the focused window, and its visible text. Use this before acting, and again after acting, to see what actually happened.",
    parameters: object({
      windowTitle: {
        type: "string",
        description:
          "Optional. Part of the title of the window to look at. Defaults to the focused window.",
      },
      includeText: {
        type: "string",
        description:
          "Set to 'yes' to read visible text with OCR when the window exposes little structure.",
        enum: ["yes", "no"],
      },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "window_list",
    domain: "os_app",
    description: "List the windows currently open, with their application names.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "window_focus",
    domain: "os_app",
    description:
      "Bring a window to the front so it can be worked with. Identify it by part of its title.",
    parameters: object(
      { windowTitle: { type: "string", description: "Part of the window's title." } },
      ["windowTitle"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "app_open",
    domain: "os_app",
    description:
      "Open an installed application by name. Only applications the user has approved can be started.",
    parameters: object({ name: { type: "string", description: "The application's name." } }, [
      "name",
    ]),
    mutating: true,
    risk: "medium",
  },
  {
    name: "folder_open",
    domain: "os_app",
    /*
     * A FOLDER IS NOT AN APPLICATION, AND CONFUSING THEM REACHED THE INTERNET.
     * "open downloads folder" went to `app_open`, which hunts for an installed
     * program by that name; none exists, and the fallback searched the web. The
     * argument here is a canonical shell-folder name from a closed set, never a
     * path — so the model cannot compose a directory to open.
     */
    description:
      "Open one of this computer's own folders in File Explorer — Downloads, Documents, Desktop, Pictures, Videos, Music, This PC. Use this for local folders instead of app_open or a web search.",
    parameters: object(
      {
        folder: {
          type: "string",
          description: "Which folder.",
          enum: [
            "Downloads",
            "Personal",
            "Desktop",
            "My Pictures",
            "My Video",
            "My Music",
            "RecycleBinFolder",
            "MyComputerFolder",
            "UsersFilesFolder",
          ],
        },
      },
      ["folder"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "app_list_installed",
    domain: "os_app",
    description:
      "List the applications installed on this computer, with publisher and version. Use this to find out what is available before deciding how to do something.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "app_focus",
    domain: "os_app",
    description:
      "Bring an application that is already running to the front. Does not start anything.",
    parameters: object({ name: { type: "string", description: "The application's name." } }, [
      "name",
    ]),
    mutating: true,
    risk: "low",
  },
  {
    name: "display_list",
    domain: "os_app",
    description:
      "List the screens attached to this computer, with their size and position. Use this before moving a window to a particular screen.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "window_arrange",
    domain: "os_app",
    description:
      "Move or resize a window: fill a screen, take the left or right half, or sit centred. Say which screen by its number from display_list.",
    parameters: object(
      {
        layout: {
          type: "string",
          description: "Where the window should go.",
          enum: ["maximise", "left", "right", "centre"],
        },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
        display: { type: "string", description: "Optional screen number, e.g. '2'." },
      },
      ["layout"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "message_draft",
    domain: "os_app",
    description:
      "Prepare a message to somebody and show it to the user for approval. This does NOT send anything — it returns a draftId that message_send needs.",
    parameters: object(
      {
        recipient: { type: "string", description: "Who the message is for." },
        message: { type: "string", description: "Exactly what would be sent." },
        app: { type: "string", description: "Which app, e.g. WhatsApp. Defaults to WhatsApp." },
      },
      ["recipient", "message"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "whatsapp_open",
    domain: "os_app",
    /*
     * WHATSAPP GETS NAMED TOOLS RATHER THAN GENERIC ONES, AND THE REASON IS
     * MEASURED. Driving it through `app_open` + `ui_tree` + `ui_act` fails at
     * every step: it is a packaged app with no .exe, its page root pretends to
     * be a text box, its chat rows are labelled with the whole row, one chat
     * appears three times, and the rows reject a generic click. All of that is
     * solved in `core/skills/whatsapp.py`; these tools are how the model
     * reaches it instead of re-deriving it badly.
     */
    description:
      "Open WhatsApp Desktop and bring it to the front. Safe to call when it is already open.",
    parameters: NO_ARGS,
    mutating: true,
    risk: "low",
  },
  {
    name: "whatsapp_find_contact",
    domain: "os_app",
    description:
      "In WhatsApp, search for a contact or group by name and open that conversation. Refuses if the name matches more than one chat. Use this before whatsapp_type. Sends nothing.",
    parameters: object(
      { contact: { type: "string", description: "The contact or group name, exactly as shown." } },
      ["contact"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "whatsapp_type",
    domain: "os_app",
    description:
      "Type a message into the open WhatsApp conversation WITHOUT sending it. The user can read it before anything goes out.",
    parameters: object(
      { message: { type: "string", description: "Exactly what to type." } },
      ["message"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "whatsapp_send",
    domain: "os_app",
    /*
     * `high`, because this is the one action here that reaches another person
     * and cannot be recalled. The band is what makes the approval real.
     */
    description:
      "Send the message currently typed in the WhatsApp conversation, then verify it appears in the transcript. A sent message cannot be unsent.",
    parameters: object(
      { message: { type: "string", description: "The message that was typed, for verification." } },
      ["message"],
    ),
    mutating: true,
    risk: "high",
  },
  {
    name: "message_to",
    domain: "os_app",
    /*
     * ONE TOOL FOR "MESSAGE <SOMEBODY> <SOMETHING>", BECAUSE THE SPLIT NEEDS EYES.
     *
     * "message meta ai hi" carries no separator between the recipient and the
     * words. Where one ends and the other begins depends on who exists in this
     * person's contact list, which is knowable only by looking at the screen.
     * A caller that had to supply `contact` and `message` separately would have
     * to guess -- and guessing is what put a whole instruction into somebody's
     * chat window.
     *
     * So this takes the raw phrase and does the looking itself.
     */
    description:
      "Message somebody when you are not sure where their name ends and the message begins. Pass the whole phrase, e.g. 'meta ai hi' or 'mummy I will be late'. OCADE reads the conversation list on screen, works out which contact the phrase starts with, opens that chat and types the rest. Nothing is sent. Use this instead of message_find_contact whenever the recipient and the text arrive together in one phrase.",
    parameters: object(
      {
        phrase: {
          type: "string",
          description: "The recipient and message together, exactly as the user said it.",
        },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["phrase"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "document_read",
    domain: "files",
    /*
     * NOT A DUPLICATE OF `file_read`, WHICH READS BYTES.
     *
     * This goes through `actions/knowledge.py:read_file`, which PARSES: PDF,
     * Word, Excel and CSV come back as text a model can answer questions
     * about. Reading a .docx as bytes returns a zip archive, which is useless
     * and looks like a failure of comprehension rather than of tooling.
     */
    description:
      "Read and understand a document — PDF, Word, Excel, CSV or text — from an approved folder, and return its contents as readable text. Use this to answer questions about a file's contents. For plain byte reads use file_read.",
    parameters: object(
      {
        folder: { type: "string", description: "Approved folder, e.g. 'documents' or 'downloads'." },
        name: { type: "string", description: "The file name." },
      },
      ["folder", "name"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "setup_status",
    domain: "conversation",
    description:
      "Check whether OCADE still needs to ask the two first-run questions: what to call the user, and whether to address them as Sir or Mam. Ask them once, at the very start.",
    parameters: object({}, []),
    mutating: false,
    risk: "read",
  },
  {
    name: "file_list",
    domain: "files",
    description:
      "List the files in one approved folder, optionally filtered by a pattern such as '*.pdf'. Use before file_read when the exact name is not known.",
    parameters: object(
      {
        folder: { type: "string", description: "Approved folder, e.g. 'documents'." },
        pattern: { type: "string", description: "Optional glob, e.g. '*.pdf'. Defaults to everything." },
      },
      ["folder"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "clipboard_watch",
    domain: "os_app",
    /*
     * The poll behind the floating panel. Cheap by construction -- it hashes
     * the clipboard and compares -- and the first call after the engine starts
     * always answers "no", so the panel cannot fly open at launch showing
     * something copied an hour ago.
     */
    description:
      "Check whether the user has copied something new since the last check. Returns the new text when there is one. Use this to offer Translate, Summarise, Explain or Fix on freshly copied text.",
    parameters: object({}, []),
    mutating: false,
    risk: "read",
  },
  {
    name: "screen_watch",
    domain: "os_app",
    description:
      "Start, stop or inspect the continuous screen buffer. Start it when a task begins so the frame answering 'what is on my screen' was captured while the user was still speaking. It stops itself once nothing reads from it.",
    parameters: object(
      {
        action: {
          type: "string",
          description: "What to do with the buffer.",
          enum: ["start", "stop", "status"],
        },
      },
      ["action"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "message_pending",
    domain: "os_app",
    description:
      "List messages that are drafted and waiting for the user's approval. Nothing has been sent.",
    parameters: object({}, []),
    mutating: false,
    risk: "read",
  },
  {
    name: "message_discard",
    domain: "os_app",
    description: "Throw away a drafted message that was never sent.",
    parameters: object(
      { draftId: { type: "string", description: "The draft's id, from message_pending." } },
      ["draftId"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "message_find_contact",
    domain: "os_app",
    /*
     * NAVIGATION ONLY, AND SEPARATE FROM DRAFTING ON PURPOSE.
     *
     * The approval card has to name the contact that was actually RESOLVED,
     * not the string the user typed. "H" is not a recipient — Hannah, Harry
     * and a group called "Holiday 2019" all match it. Resolving first means
     * the card says who is really about to be messaged, and the engine refuses
     * outright when more than one conversation matches.
     */
    description:
      "In a chat app that is already open, type a name into its search box and open that one conversation. Use this BEFORE message_draft so the approval names the real contact. It refuses if the name matches more than one conversation, and it never sends anything.",
    parameters: object(
      {
        contact: { type: "string", description: "The contact or group name to open." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["contact"],
    ),
    mutating: true,
    // Medium: it clicks a conversation open, which is visible and reversible,
    // but it is not a read.
    risk: "medium",
  },
  {
    name: "message_send",
    domain: "os_app",
    /*
     * `high` risk, which is what makes the approval real. The permission layer
     * refuses high-risk tools outright in autonomous mode and always asks a
     * person otherwise, so "the user approved it" is enforced by the same
     * mechanism as every other irreversible action rather than by this tool
     * being trusted to ask nicely.
     */
    description:
      "Send a message that message_draft already prepared. Requires the draftId and the user's explicit approval. A message cannot be unsent.",
    parameters: object(
      {
        draftId: { type: "string", description: "The draftId from message_draft." },
        recipient: {
          type: "string",
          description:
            "Who it goes to. Must be exactly what message_draft returned — OCADE re-checks it against the draft and refuses if it differs.",
        },
        message: {
          type: "string",
          description:
            "The exact message text from message_draft. OCADE re-checks it against the draft and refuses if it differs.",
        },
        windowTitle: {
          type: "string",
          description: "The already-open conversation window to send from.",
        },
      },
      ["draftId", "recipient", "message"],
    ),
    mutating: true,
    risk: "high",
  },
  {
    name: "speak",
    domain: "os_app",
    description:
      "Say something out loud in OCADE's voice. Use for short spoken updates, not for reading long documents aloud.",
    parameters: object({ text: { type: "string", description: "What to say." } }, ["text"]),
    mutating: false,
    risk: "read",
  },
  {
    name: "listen",
    domain: "os_app",
    description:
      "Listen to the microphone and return what the user said. Stops automatically when they finish speaking.",
    parameters: object({
      maxMs: { type: "number", description: "Optional. Give up after this long." },
    }),
    mutating: false,
    risk: "read",
  },
  /*
   * ui_tree / ui_act are the UNIVERSAL pair: they work on an application nobody
   * anticipated, because they ask Windows what is on screen rather than knowing
   * it in advance.
   *
   * They overlap with control_find / control_activate below, and the difference
   * decides which to reach for. The control_* pair acts by LABEL and needs the
   * label guessed correctly first — good when the target is known ("press
   * Save"). This pair LISTS what is actually there and then acts on a ref taken
   * from that list — the only option when the application is unfamiliar, which
   * is the case OCADE is built for.
   */
  {
    name: "screen_find",
    domain: "os_app",
    description:
      "Find something on screen by describing it — a button, a field, a label — in ANY application, including ones with no standard controls. OCADE tries the accessibility tree first, then reads the screen text. The result says which method found it and whether acting on it needs a mouse click.",
    parameters: object(
      {
        query: { type: "string", description: "What to look for, e.g. 'Save button'." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
        allowVision: {
          type: "string",
          description:
            "Set to 'yes' ONLY as a last resort for a window with no controls and no readable text. It is slow (up to 45s) and its coordinates are estimates that are often refused as out of bounds.",
          enum: ["yes", "no"],
        },
      },
      ["query"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "parallel_search",
    domain: "web",
    /*
     * THE DEFAULT WAY TO ANSWER A QUESTION ABOUT THE REAL WORLD.
     *
     * `web_search` tries three engines in order and pays each failure in full
     * before the next. This asks all three at once and takes the first answer
     * that clears a quality bar -- so the cost is the fastest engine rather
     * than the sum of the slow ones, and one provider rate-limiting stops
     * being something the user waits through.
     */
    description:
      "Answer a question about the real world — news, live data, facts, prices, people — by asking several search engines AT ONCE and using whichever answers first. No browser window opens. Prefer this over web_search for anything the user wants to know rather than to look at.",
    parameters: object(
      {
        query: { type: "string", description: "What to find out." },
        maxResults: { type: "number", description: "How many results. Defaults to 5." },
      },
      ["query"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "screen_type",
    domain: "os_app",
    /*
     * THE CLOSED LOOP, AND THE ONLY TYPING TOOL THAT CONFIRMS BY LOOKING.
     *
     * `type_text` writes through the accessibility tree and reads the value
     * back out of the control, which is faster and is right nearly always.
     * This one exists for the case that beat it: a control that ACCEPTS a
     * write, reports success, and displays nothing -- a Chromium
     * contenteditable, a custom-drawn field, a canvas. There the only witness
     * is the screen itself.
     *
     * `submit` is the reason the verification is not optional. Pressing Enter
     * is the half that cannot be taken back, so it happens only when the
     * read-back shows the text is really there.
     */
    description:
      "Type into a field by LOOKING at the screen: OCADE finds the field, clicks it, types, then takes another screenshot and reads the text back before doing anything else. Slower than type_text — use this when type_text reported success but nothing appeared, or in a window with custom-drawn fields. Set submit to press Enter, which happens ONLY if the text is confirmed on screen.",
    parameters: object(
      {
        field: {
          type: "string",
          description: "The field to type in, described as you would to a person, e.g. 'search box'.",
        },
        text: { type: "string", description: "Exactly what to type." },
        submit: {
          type: "string",
          description:
            "'yes' to press Enter afterwards. Only pressed if the typed text is verified on screen.",
          enum: ["yes", "no"],
        },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
        allowVision: {
          type: "string",
          description:
            "Set to 'yes' ONLY for a window with no controls and no readable text. Slow.",
          enum: ["yes", "no"],
        },
      },
      ["field", "text"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "screen_act",
    domain: "os_app",
    description:
      "Find something on screen by describing it and operate it — a button, a menu item, a row — then check what changed. Uses the accessibility tree when the control is visible to it and a real click when it is not. Prefer ui_act when the control already appears in ui_tree.",
    parameters: object(
      {
        what: { type: "string", description: "What to operate, e.g. 'the Send button'." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
        allowVision: {
          type: "string",
          description: "Set to 'yes' ONLY for a window with no controls and no readable text. Slow.",
          enum: ["yes", "no"],
        },
      },
      ["what"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "screen_read",
    domain: "os_app",
    /*
     * Deliberately a PHOTOGRAPH, not a control query. `ui_tree` answers "what
     * does this application say it contains"; this answers "what is actually
     * on the glass". They disagree exactly when something has gone wrong,
     * which is when this is worth its cost.
     */
    description:
      "Read the text currently visible on screen, by taking a screenshot and running OCR. Use this to check what a window is really showing — an error message, a search result, whether a field is empty — especially when ui_tree and the screen seem to disagree.",
    parameters: object(
      {
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      [],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "screen_click",
    domain: "os_app",
    /*
     * THE ONLY TOOL THAT MOVES THE PHYSICAL MOUSE, AND IT TAKES A TARGET
     * RATHER THAN COORDINATES.
     *
     * Accepting x and y would make this a general-purpose blind click, which
     * is the thing the whole perception ladder exists to avoid. Requiring the
     * object `screen_find` returned means the coordinate always has a
     * provenance — OCR or vision — and a target the accessibility tree can
     * already see is refused outright, because `ui_act` can operate that one
     * and report what changed.
     */
    description:
      "Click something that has no accessibility handle — in Blender, a game, a remote desktop, or any window with custom-drawn controls. Pass the target object that screen_find returned. This is the ONLY action that moves the real mouse, so use ui_act instead whenever the control appears in ui_tree. The receipt says whether the screen changed afterwards.",
    parameters: object(
      {
        target: {
          type: "object",
          description: "A target object from screen_find. Raw coordinates are refused.",
        },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["target"],
    ),
    mutating: true,
    // Medium, not low: it is a blind action on a coordinate, and the thing
    // under that coordinate is whatever moved there since it was found.
    risk: "medium",
  },
  {
    name: "app_discover",
    domain: "os_app",
    description:
      "Find which applications are installed and how to launch them, from the Windows registry, Start Menu shortcuts and PATH. Pass a name to resolve it to a specific program, or omit it to list everything.",
    parameters: object({
      name: { type: "string", description: "Optional. The application to resolve, e.g. 'chrome'." },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "ui_tree",
    domain: "os_app",
    /*
     * `textEntry` AND `shellOnly` ARE NAMED IN THE DESCRIPTION ON PURPOSE.
     *
     * The model is the thing choosing where to type, so the two facts that stop
     * it choosing wrongly have to reach it. Measured on Discord: the whole page
     * is published as one enabled, focusable `Document` two million pixels
     * across, and a model told only the roles and sizes picks it every time.
     * `textEntry` is the field that separates a real box from the page around
     * it, and `shellOnly` is how the model learns to wait rather than conclude
     * an app is empty.
     */
    description:
      "List every control in a window that can actually be operated — buttons, text boxes, lists, menus — each with a ref you can act on. Use this FIRST when working in an application you have not seen, instead of guessing where to click. Only type into a control whose textEntry is true: a large focusable region is usually the whole page, not a text box. If shellOnly is true the app has not finished loading — wait and read it again rather than concluding it is empty. Does not change anything.",
    parameters: object({
      windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      query: {
        type: "string",
        description: "Optional. Only return controls whose name, id or kind contains this.",
      },
      limit: { type: "number", description: "Optional. How many controls to return (default 60)." },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "ui_act",
    domain: "os_app",
    description:
      "Operate one control from ui_tree by its ref: click, toggle, select, focus, expand, or set_text. Pass the ref's fingerprint so OCADE can refuse if the window changed since you looked. Checks afterwards whether anything actually changed.",
    parameters: object(
      {
        ref: { type: "string", description: "The control's ref from ui_tree, e.g. 'e4'." },
        action: {
          type: "string",
          description: "One of: click, toggle, select, set_text, focus, expand.",
        },
        text: { type: "string", description: "Required for set_text. The text to put in." },
        fingerprint: {
          type: "string",
          description: "The fingerprint ui_tree gave for this ref. Strongly recommended.",
        },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["ref", "action"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "system_volume",
    domain: "os_app",
    description:
      "Read or change this computer's volume: get, set (0-100), step (relative), mute, unmute. Reports the level the sound device actually reports afterwards.",
    parameters: object(
      {
        action: { type: "string", description: "get, set, step, mute, unmute or toggle_mute." },
        level: { type: "number", description: "For set: 0 to 100." },
        by: { type: "number", description: "For step: percent to add, may be negative." },
      },
      ["action"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "control_find",
    domain: "os_app",
    description:
      "Find a button, field or other control in a window by what it is called. Returns matches with their state. Does not press anything.",
    parameters: object(
      {
        name: { type: "string", description: "The visible label, e.g. 'Continue'." },
        role: { type: "string", description: "Optional control kind, e.g. 'Button', 'Edit'." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["name"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "control_activate",
    domain: "os_app",
    description:
      "Press a button or activate a control by its label. OCADE checks afterwards that the window actually changed, and reports it if it did not.",
    parameters: object(
      {
        name: { type: "string", description: "The visible label of the control to press." },
        role: { type: "string", description: "Optional control kind, e.g. 'Button'." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["name"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "control_set_text",
    domain: "os_app",
    description:
      "Type text into a named field in an application. Refuses anything that looks like a password, code or payment value.",
    parameters: object(
      {
        name: { type: "string", description: "The field's label." },
        value: { type: "string", description: "The text to put in it." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["name", "value"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "type_text",
    domain: "os_app",
    description:
      "Type text into whatever currently has focus — a document, a search box, an editor. Use control_set_text instead when the field has a name. Refuses anything that looks like a password, code or payment value.",
    parameters: object(
      {
        text: { type: "string", description: "The text to type." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["text"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "press_key",
    domain: "os_app",
    description:
      "Press a single key such as Enter, Escape, Tab or a function key, optionally with Ctrl, Shift or Alt.",
    parameters: object(
      {
        key: { type: "string", description: "The key, e.g. 'enter', 'escape', 's', 'f5'." },
        modifiers: {
          type: "string",
          description: "Optional, e.g. 'ctrl' or 'ctrl+shift'.",
        },
      },
      ["key"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "system_status",
    domain: "os_app",
    description:
      "Read how the computer is doing: processor load, memory, disk space, battery charge and whether it is charging, uptime, and the processes using the most memory. Every number is measured, and anything this machine cannot report comes back empty rather than guessed. Read-only.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "system_brightness",
    domain: "os_app",
    description:
      "Read or set the display brightness. Setting it reads the display back afterwards to confirm the change took.",
    parameters: object({
      action: { type: "string", description: "get or set.", enum: ["get", "set"] },
      percent: { type: "number", description: "For set: 0 to 100." },
    }),
    mutating: true,
    risk: "low",
  },
  {
    name: "media_control",
    domain: "os_app",
    /*
     * `low` risk: every one of these is undone by sending it again, and none of
     * them destroys anything. Pausing music is not a decision worth stopping a
     * hands-free conversation to confirm.
     */
    description:
      "Play, pause, skip or go back a track, or mute — anywhere on this computer. Works on Spotify, YouTube in a browser, or any media player WITHOUT needing to focus its window first.",
    parameters: object(
      {
        action: {
          type: "string",
          description: "What to do.",
          enum: ["playpause", "next", "previous", "stop", "mute"],
        },
      },
      ["action"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "bluetooth_status",
    domain: "os_app",
    description:
      "Check whether Bluetooth is switched on and list the paired devices, saying which are currently connected. Read-only.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "audio_devices",
    domain: "os_app",
    description:
      "List the speakers, headsets and other audio devices Windows currently has enabled. Read-only.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  /*
   * THE REST OF THE MACHINE. Every one of these already existed in the engine
   * and was reachable by nothing: the bridge had `system.wifi`, `system.power`,
   * `system.autostart` and `clipboard` handlers that no tool, no router rule
   * and no adapter ever called. A capability nobody can reach is indistinguish-
   * able from one that was never built, and this is the half of the wiring that
   * was missing.
   */
  {
    name: "system_wifi",
    domain: "os_app",
    description:
      "Check which network this computer is on, or switch the WiFi adapter on or off. Turning the adapter off will disconnect anything using it.",
    parameters: object({
      action: { type: "string", description: "What to do.", enum: ["status", "on", "off"] },
    }),
    mutating: true,
    // Medium rather than low: switching WiFi off cuts the network under
    // whatever else the user is doing, and the room they are in may be the
    // only place they can switch it back.
    risk: "medium",
  },
  {
    name: "system_power",
    domain: "os_app",
    /*
     * `high`, AND THE ENGINE ASKS AGAIN ON TOP OF THAT.
     *
     * Shutting down closes unsaved work belonging to somebody who may not be
     * at the screen, and it is the one action in the whole catalogue with no
     * receipt — nothing can verify a shutdown from inside the process being
     * shut down. So the risk band asks a person, AND the engine refuses
     * shutdown/restart unless `confirmed` is true. Two gates, because one gate
     * with a bug is no gate.
     */
    description:
      "Sleep, lock, shut down or restart this computer. Shutting down or restarting closes everything that is open, including unsaved work, and cannot be undone — pass confirmed only when the user has explicitly said to.",
    parameters: object(
      {
        action: {
          type: "string",
          description: "What to do.",
          enum: ["sleep", "lock", "shutdown", "restart"],
        },
        confirmed: {
          type: "string",
          description: "'yes' only when the user explicitly asked to shut down or restart.",
          enum: ["yes", "no"],
        },
      },
      ["action"],
    ),
    mutating: true,
    risk: "high",
  },
  {
    name: "autostart",
    domain: "os_app",
    description:
      "Check whether OCADE starts automatically when the user logs in, or turn that on or off. Uses the Windows registry, a macOS LaunchAgent or a Linux .desktop entry, all for this user only.",
    parameters: object({
      enable: {
        type: "string",
        description: "Omit to just check. 'yes' to start at login, 'no' to stop.",
        enum: ["yes", "no"],
      },
    }),
    mutating: true,
    risk: "medium",
  },
  {
    name: "clipboard_read",
    domain: "os_app",
    description:
      "Read what the user has copied, so it can be translated, summarised, explained or corrected. Returns the text and nothing else.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "clipboard_write",
    domain: "os_app",
    description:
      "Put text on the clipboard so the user can paste it. Replaces whatever was there.",
    parameters: object({ text: { type: "string", description: "The text to copy." } }, ["text"]),
    mutating: true,
    risk: "low",
  },
  {
    name: "clipboard_act",
    domain: "os_app",
    /*
     * THE FOUR BUTTONS ON THE FLOATING PANEL, AS ONE TOOL.
     *
     * The engine takes the text from the clipboard ITSELF rather than accepting
     * it as an argument, so what gets worked on is provably what the user
     * copied. It also refuses outright when the clipboard looks like a password
     * — which it often is, because that is what a password manager's copy
     * button puts there — rather than sending it to a model and into a log.
     */
    description:
      "Translate, summarise, explain or correct whatever the user has just copied. Reads the clipboard itself and answers with the local model. Refuses if the clipboard looks like a password or a code.",
    parameters: object(
      {
        action: {
          type: "string",
          description: "What to do with the copied text.",
          enum: ["translate", "summarise", "explain", "fix"],
        },
        language: {
          type: "string",
          description: "For translate. Defaults to the user's remembered language.",
        },
      },
      ["action"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "engine_status",
    domain: "os_app",
    description:
      "Check whether the local model is running and pulled, and whether this computer has a network route. Use this when something failed and it is not clear whether the cause was the model or the connection.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "see",
    domain: "os_app",
    /*
     * DELIBERATELY SEPARATE FROM `screen_observe`, WHICH IS THE FASTER ANSWER
     * NEARLY EVERY TIME. `screen_observe` reads the accessibility tree: it is
     * quick, exact, and returns things that can be acted on. This renders a
     * picture and asks a vision model what it depicts, which takes seconds and
     * returns prose that cannot be clicked.
     *
     * It earns its place on the two questions the tree cannot answer: what a
     * custom-drawn window (a game, a video, Blender) is showing, and what the
     * webcam can see. The description says so, because a model that reaches
     * for this first makes every ordinary request ten times slower.
     */
    description:
      "Look at the screen or the webcam and describe it in words. SLOW — use screen_observe or ui_tree first for anything with normal controls. Use this only for a window that draws its own graphics (a game, a video, a design tool) or to look through the camera. Returns a description and the picture it was made from.",
    parameters: object({
      source: {
        type: "string",
        description: "What to look at. Defaults to the screen.",
        enum: ["screen", "webcam"],
      },
      question: {
        type: "string",
        description:
          "Optional. What to look for, e.g. 'what does the error say'. Narrows the description.",
      },
      windowTitle: {
        type: "string",
        description: "Optional, for the screen: part of a window's title. Defaults to everything.",
      },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "camera_list",
    domain: "os_app",
    description:
      "List the cameras attached to this computer. Each is opened briefly to check it responds, then released.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "reminder_set",
    domain: "os_app",
    description:
      "Set a reminder that fires even if OCADE is closed, using the operating system's own scheduler. Times it understands: 'in 20 minutes', 'in 2 hours', 'at 18:30', 'tomorrow 09:00'.",
    parameters: object(
      {
        message: { type: "string", description: "What the reminder should say." },
        when: { type: "string", description: "When it should fire." },
      },
      ["message", "when"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "reminder_list",
    domain: "os_app",
    description: "List the reminders OCADE has scheduled with the operating system.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "reminder_cancel",
    domain: "os_app",
    description:
      "Cancel one scheduled reminder by the task name that reminder_list returned. Only OCADE's own reminders can be cancelled.",
    parameters: object({ task: { type: "string", description: "The task name to cancel." } }, [
      "task",
    ]),
    mutating: true,
    risk: "low",
  },
  {
    name: "game_list",
    domain: "os_app",
    description:
      "List the games installed through Steam and Epic, read from the launchers' own manifests, and say which are behind and by how much. Works while the launchers are closed.",
    parameters: object({
      launcher: { type: "string", description: "Optional.", enum: ["steam", "epic", "all"] },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "game_update",
    domain: "os_app",
    description:
      "Ask Steam or Epic to bring a game up to date. Name the game, or omit it to update everything that is behind. This hands off to the launcher, which does the downloading and shows its own progress — it does not install, buy or delete anything.",
    parameters: object({
      game: { type: "string", description: "The game's title. Omit to update everything behind." },
      launcher: { type: "string", description: "Optional.", enum: ["steam", "epic", "all"] },
    }),
    mutating: true,
    risk: "medium",
  },
  {
    name: "phone_dashboard",
    domain: "os_app",
    /*
     * `high`, BECAUSE THIS OPENS A PORT.
     *
     * Everything else in this catalogue acts on the machine in front of the
     * user. This makes the machine reachable from the network it is on, and a
     * pairing QR photographed over somebody's shoulder is a real thing. The
     * engine gates it further with a token and a command allow-list, but the
     * DECISION to open it belongs to a person.
     */
    description:
      "Open or close the phone dashboard: a small web page on this computer that the user's phone can control OCADE from over the local network. Opening it returns a QR code to scan and a pairing code. It closes itself after 30 minutes of no use.",
    parameters: object({
      action: {
        type: "string",
        description: "What to do.",
        enum: ["start", "stop", "status"],
      },
    }),
    mutating: true,
    risk: "high",
  },
];

/* ------------------------------------------------------------- files -- */

/*
 * OCADE's own temporary folder.
 *
 * Separate from the approved-folder tools below, and narrower on purpose: these
 * take a NAME, never a path, and the host resolves it inside one directory it
 * owns. That makes "write this down and open it" a safe thing to ask for
 * without the user first having to approve a folder full of their own work.
 */
const WORKSPACE: ToolDefinition[] = [
  {
    name: "workspace_list",
    domain: "files",
    description:
      "List the files in OCADE's own temporary working folder. Use this to see what has already been made during this task.",
    parameters: object({
      match: { type: "string", description: "Optional part of a file name to filter by." },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "workspace_read",
    domain: "files",
    description: "Read a text file from OCADE's own temporary working folder.",
    parameters: object({ name: { type: "string", description: "The file's name." } }, ["name"]),
    mutating: false,
    risk: "read",
  },
  {
    name: "workspace_write",
    domain: "files",
    description:
      "Write a text file into OCADE's own temporary working folder — notes, a draft, a summary. Read back afterwards to confirm what landed.",
    parameters: object(
      {
        name: { type: "string", description: "The file's name, e.g. 'notes.txt'." },
        content: { type: "string", description: "The text to write." },
      },
      ["name", "content"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "workspace_open",
    domain: "files",
    description:
      "Open a file from OCADE's temporary folder in this computer's default editor, so the user can see it.",
    parameters: object({ name: { type: "string", description: "The file's name." } }, ["name"]),
    mutating: true,
    risk: "medium",
  },
  {
    name: "workspace_discard",
    domain: "files",
    description:
      "Move a file in OCADE's temporary folder to the recycle bin. Always reversible from there.",
    parameters: object({ name: { type: "string", description: "The file's name." } }, ["name"]),
    mutating: true,
    risk: "high",
  },
];

/*
 * The user's own documents.
 *
 * `folder` is a name out of a closed list, never a path. The engine refuses
 * anything else, so the description below has to say so plainly — a model
 * told it may name "an approved folder" will invent one, spend a step being
 * refused, and invent another.
 */
const USER_FOLDERS = "desktop, downloads, documents, pictures, music or videos";

const folderArg = {
  type: "string" as const,
  description: `Which folder: ${USER_FOLDERS}. Nothing else is reachable.`,
};

const FILES: ToolDefinition[] = [
  {
    name: "office_read",
    domain: "files",
    description:
      "Read a spreadsheet (.csv/.xlsx) or Word document (.docx) from one of the user's folders. Returns the columns and a sample of rows, not the whole file.",
    parameters: object(
      {
        folder: { type: "string", description: "documents, downloads, desktop, pictures." },
        path: { type: "string", description: "The file's name inside that folder." },
      },
      ["folder", "path"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "office_write",
    domain: "files",
    description:
      "Write a spreadsheet (rows) or Word document (paragraphs). OCADE reopens the file afterwards and reports its size and row count as a receipt.",
    parameters: object(
      {
        folder: { type: "string", description: "documents, downloads, desktop, pictures." },
        path: {
          type: "string",
          description: "The file name to write, including .xlsx/.csv/.docx.",
        },
        rows: {
          type: "array",
          description: "For spreadsheets: a list of objects, one per row.",
          items: { type: "object" },
        },
        paragraphs: {
          type: "array",
          description: "For documents: the paragraphs of text.",
          items: { type: "string" },
        },
        title: { type: "string", description: "Optional heading for a document." },
      },
      ["folder", "path"],
    ),
    mutating: true,
    risk: "medium",
  },
  ...WORKSPACE,
  {
    name: "file_search",
    domain: "files",
    description: `Search for files in one of the user's folders (${USER_FOLDERS}) by part of the name, by file extension, or both. Returns names, sizes and dates.`,
    parameters: object(
      {
        folder: folderArg,
        match: { type: "string", description: "Part of the file name to look for." },
        extension: {
          type: "string",
          description: "Optional file extension to filter by, e.g. '.pdf'. Use with or without match.",
        },
      },
      ["folder"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "folder_create",
    domain: "files",
    description: `Make a new folder inside one of the user's folders (${USER_FOLDERS}). Confirms afterwards that it exists.`,
    parameters: object(
      { folder: folderArg, name: { type: "string", description: "The new folder's name." } },
      ["folder", "name"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "file_info",
    domain: "files",
    description: `Read one file's size, type and dates, from one of the user's folders (${USER_FOLDERS}).`,
    parameters: object(
      { folder: folderArg, path: { type: "string", description: "The file's name." } },
      ["folder", "path"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "disk_usage",
    domain: "files",
    description:
      "How much disk space is used and free. Use this for 'am I running out of space'.",
    parameters: object({
      folder: { type: "string", description: "Optional. Which drive or folder to measure." },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "largest_files",
    domain: "files",
    description: `Find the biggest files in one of the user's folders (${USER_FOLDERS}). Use this for 'what is taking up my space'.`,
    parameters: object({
      folder: folderArg,
      count: { type: "number", description: "How many to list. Default 10." },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "desktop_organise",
    domain: "files",
    /*
     * SAFE TO RUN ON SOMEBODY'S DESKTOP FOR THREE SPECIFIC REASONS, and the
     * description says the third because it is the one a user worries about:
     * files only ever move INTO a subfolder of the same desktop, a name
     * collision is skipped rather than overwritten, and folders and hidden
     * files are never touched. Every move is undone by dragging it back.
     */
    description:
      "Tidy the desktop by moving loose files into folders by type — Images, Documents, Videos, Music, Archives, Code, Others. Never overwrites, never touches folders or hidden files, and every move is reversible by dragging it back. Reports how many actually moved, counted from the desktop.",
    parameters: NO_ARGS,
    mutating: true,
    // Medium: it moves a lot of files at once, which is visible and reversible
    // but is not something to do without the user having asked for it.
    risk: "medium",
  },
  {
    name: "file_read",
    domain: "files",
    description: `Read the text content of a file in one of the user's folders (${USER_FOLDERS}).`,
    parameters: object(
      {
        folder: folderArg,
        path: { type: "string", description: "The file's name inside that folder." },
      },
      ["folder", "path"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "file_copy",
    domain: "files",
    description:
      "Copy a file. The copy is verified by comparing content hashes afterwards, not by assuming success. Refuses rather than overwrite anything that already exists.",
    parameters: object(
      {
        folder: folderArg,
        from: { type: "string", description: "The file to copy." },
        to: { type: "string", description: "The name for the copy." },
      },
      ["folder", "from", "to"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "file_move",
    domain: "files",
    description:
      "Move or rename a file within one folder. Refuses rather than overwrite an existing name.",
    parameters: object(
      {
        folder: folderArg,
        from: { type: "string", description: "The file to move." },
        to: { type: "string", description: "Its new name." },
      },
      ["folder", "from", "to"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "file_trash",
    domain: "files",
    description:
      "Move a file to the recycle bin. Always reversible — OCADE cannot permanently delete a file. Returns an id that file_restore takes.",
    parameters: object(
      {
        folder: folderArg,
        path: { type: "string", description: "The file to move to the recycle bin." },
      },
      ["folder", "path"],
    ),
    mutating: true,
    risk: "high",
  },
  {
    name: "file_restore",
    domain: "files",
    description:
      "Put a file back from the recycle bin using the id file_trash returned, confirming afterwards that its contents are unchanged.",
    parameters: object({ id: { type: "string", description: "The id file_trash returned." } }, [
      "id",
    ]),
    mutating: true,
    risk: "low",
  },
  {
    name: "code_review",
    domain: "files",
    /*
     * THE PARSER DOES THE COUNTING; THE MODEL DOES THE JUDGING.
     *
     * A model asked to review code from the text alone invents line numbers,
     * and a review that sends the reader to a line where nothing is wrong is
     * worse than no review — they stop trusting the whole report. So the engine
     * parses (`ast` for Python, a labelled shallow scan for everything else)
     * and returns findings whose line numbers came out of a parse tree. The
     * model reads those and says what they mean.
     *
     * GENERATING code needs no tool at all: the model already writes it, and
     * `workspace_write` or `office_write` puts it somewhere.
     */
    description:
      "Parse a piece of source code and return real findings with real line numbers: syntax errors, bare excepts, mutable default arguments, eval, hard-coded credentials, unused imports, over-long functions, plus the list of functions and classes. Pass `code` for something the user pasted, or `folder` and `name` for a file on disk. Read the findings and explain what matters — do not invent findings of your own.",
    parameters: object({
      code: { type: "string", description: "The source to review. Use this for pasted code." },
      folder: folderArg,
      name: { type: "string", description: "The file's name inside that folder." },
      language: {
        type: "string",
        description: "Optional, e.g. 'python', 'typescript'. Detected from the name when omitted.",
      },
    }),
    mutating: false,
    risk: "read",
  },
];

/* --------------------------------------------------------------- web -- */

const WEB: ToolDefinition[] = [
  {
    name: "browser_open",
    domain: "web",
    description:
      "Open or focus the user's own signed-in browser window. Do this before other browser actions.",
    parameters: object({
      browser: { type: "string", description: "Which browser to use.", enum: ["chrome", "edge"] },
    }),
    mutating: true,
    /*
     * HIGH, AND THE RISK BAND IS LOAD-BEARING RATHER THAN DECORATIVE.
     *
     * This was `low` while the tool opened a throwaway profile, and `low` was
     * the honest answer then: a brand-new browser with no cookies can reach
     * nothing that belongs to anybody. It now opens the profile the user is
     * SIGNED IN TO, which means their mail, their bank and their messages are
     * reachable by whatever runs next.
     *
     * The band is what carries the approval. `runOneCall` only sends
     * `confirmed: true` for a high-risk tool, the server refuses a high-risk
     * action that arrives unconfirmed, and the adapter turns that same
     * confirmation into the host's `explicitProfileApproval`. So the user's
     * "yes" is the only thing that can unlock the signed-in profile, and there
     * is no path that infers it.
     */
    risk: "high",
  },
  {
    name: "browser_navigate",
    domain: "web",
    description: "Go to a web address in the managed browser.",
    parameters: object({ url: { type: "string", description: "The full https address." } }, [
      "url",
    ]),
    mutating: true,
    risk: "low",
  },
  {
    name: "browser_read",
    domain: "web",
    description:
      "Read the current page: its title, address, visible text, headings, links and form fields.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "browser_click",
    domain: "web",
    description:
      "Click something on the page by its visible text or role. OCADE verifies afterwards that the page actually changed.",
    parameters: object(
      {
        text: { type: "string", description: "The visible text of the thing to click." },
        role: { type: "string", description: "Optional role, e.g. 'link', 'button'." },
      },
      ["text"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "browser_type",
    domain: "web",
    description:
      "Type into a field on the page. Refuses password and payment fields, which stay under the user's control.",
    parameters: object(
      {
        selector: { type: "string", description: "The field, by its label, placeholder or role." },
        value: { type: "string", description: "The text to enter." },
      },
      ["selector", "value"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "browser_scroll",
    domain: "web",
    description:
      "Scroll the page down or up by one screen, then read where it ended up. Use this to see the rest of a long page before deciding what to click.",
    parameters: object({
      direction: { type: "string", description: "Which way to scroll.", enum: ["down", "up"] },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "browser_key",
    domain: "web",
    description:
      "Press a key on the page — Enter to submit a search, Escape to close a dialog, PageDown to move through a document.",
    parameters: object(
      {
        key: {
          type: "string",
          description: "The key to press.",
          enum: ["Enter", "Escape", "Tab", "PageDown", "PageUp", "Home", "End"],
        },
      },
      ["key"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "browser_media",
    domain: "web",
    description:
      "Play, pause, mute or unmute the video or audio on the page the user is looking at.",
    parameters: object(
      {
        action: {
          type: "string",
          description: "What to do.",
          enum: ["play", "pause", "mute", "unmute"],
        },
      },
      ["action"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "folder_item_open",
    domain: "os_app",
    /*
     * The second half of "open downloads folder and open the folder named
     * mummy". `folder_open` gets you into Downloads; this walks the file list
     * and invokes one row. A model cannot do this itself — it cannot see the
     * list — so it is a deterministic skill rather than a prompt.
     */
    description:
      "Open a folder or file that is visible INSIDE an already-open File Explorer window, by its exact name. Use after folder_open. Refuses if the name matches more than one item.",
    parameters: object(
      {
        item: { type: "string", description: "The folder or file name as shown." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["item"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "youtube_play",
    domain: "web",
    /*
     * SEPARATE FROM `youtube_search` BECAUSE THEY ARE DIFFERENT REQUESTS.
     * "Search YouTube for X" wants a page of results. "Play X" wants sound
     * coming out of the speakers, and answering it with a results page — which
     * is what happened, three times in one session — is the wrong action
     * rather than a partial one.
     */
    description:
      "Search YouTube and PLAY the first video result, skipping the advert if one runs. Use this whenever the user says play, put on, or listen to. Use youtube_search only when they want to see results without playing anything.",
    parameters: object(
      { query: { type: "string", description: "What to play, e.g. 'lofi beats'." } },
      ["query"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "youtube_search",
    domain: "web",
    description:
      "Search YouTube for something and open the results. Needs an actual thing to search for — never call this without one.",
    parameters: object({ query: { type: "string", description: "What to search YouTube for." } }, [
      "query",
    ]),
    mutating: true,
    risk: "low",
  },
  {
    name: "browser_tabs",
    domain: "web",
    description: "List the open tabs in the managed browser with their titles and addresses.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "web_search",
    domain: "web",
    description:
      "Search the web for current information and return results with their sources, so answers can be cited.",
    parameters: object({ query: { type: "string", description: "What to search for." } }, [
      "query",
    ]),
    mutating: false,
    risk: "read",
  },
  {
    name: "search_mode",
    domain: "web",
    /*
     * ONE ENGINE, FIVE QUESTION SHAPES.
     *
     * "What is the news on X", "compare X and Y", "how much is X" and "explain
     * X" want different things, and one query shape answers all of them badly:
     * a news query sorted by relevance returns a 2019 article, and a price
     * query without the word "price" returns a Wikipedia page. `news` also
     * narrows the time window at the engine, because a month-old headline is
     * not news.
     */
    description:
      "Search the web with the query shaped for the KIND of question being asked: news (recent only), research, price, compare, or plain search. Prefer this over web_search whenever the question has an obvious shape.",
    parameters: object(
      {
        query: { type: "string", description: "What to search for, in the user's own words." },
        mode: {
          type: "string",
          description: "Which shape of question this is.",
          enum: ["search", "news", "research", "price", "compare"],
        },
      },
      ["query", "mode"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "flight_search",
    domain: "web",
    description:
      "Look up live flight prices and options between two places. Reports what it found with sources; it never books anything, because buying a seat is the user's own decision in their own browser.",
    parameters: object(
      {
        from: { type: "string", description: "Where from — a city or airport." },
        to: { type: "string", description: "Where to." },
        when: { type: "string", description: "Optional date or month." },
      },
      ["from", "to"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "weather",
    domain: "web",
    description:
      "Live weather. Uses the city OCADE has remembered about the user unless another is named, so 'what's the weather' works with no arguments.",
    parameters: object({
      city: { type: "string", description: "Optional. Defaults to the user's remembered city." },
    }),
    mutating: false,
    risk: "read",
  },
];

/* ------------------------------------------------------- conversation -- */

/*
 * CONTINUITY: what OCADE still knows tomorrow, and when it speaks first.
 *
 * THIS DOMAIN WAS EMPTY, AND THE WHOLE LAYER BEHIND IT WAS ALREADY BUILT.
 * `core/memory.py` and `core/presence.py` were finished, tested and wired into
 * the bridge as eleven handlers — and not one of them appeared in this file, so
 * no model could ever call them and no router rule pointed at them. OCADE could
 * remember, and had no way to be asked to.
 *
 * `conversation` is the right home for them because that is what they are: the
 * tools of a conversation that continues. None of them touches the machine.
 * Every one is small, cheap and reversible, so they run without a prompt.
 */
const CONTINUITY: ToolDefinition[] = [
  {
    name: "memory_remember",
    domain: "conversation",
    description:
      "Remember something about the user for future sessions — a preference, a detail, a decision. Refuses anything that looks like a password or a code. Use this whenever the user says to remember something.",
    parameters: object(
      {
        fact: { type: "string", description: "What to remember, in the user's own words." },
        tag: { type: "string", description: "Optional one-word category." },
      },
      ["fact"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "memory_recall",
    description:
      "Look up what OCADE already knows about something. Use this before saying you do not know — the answer may be from a previous session.",
    domain: "conversation",
    parameters: object({
      query: { type: "string", description: "What to look for. Omit for the most recent." },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "memory_forget",
    domain: "conversation",
    description:
      "Delete everything remembered that matches a phrase. The user's memory is theirs to erase.",
    parameters: object({ query: { type: "string", description: "What to forget." } }, ["query"]),
    mutating: true,
    risk: "medium",
  },
  {
    name: "memory_project",
    domain: "conversation",
    description:
      "Record, or touch, something the user is working on, so OCADE knows it is current. Mentioning an existing project again keeps it from expiring.",
    parameters: object(
      {
        name: { type: "string", description: "The project's name." },
        note: { type: "string", description: "Optional note about where it stands." },
      },
      ["name"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "memory_identity",
    domain: "conversation",
    /*
     * THE ASSISTANT'S NAME IS IN HERE, AND IT USED TO BE REFUSED.
     *
     * `assistantName` was fixed to "OCADE" on the reasoning that a product with
     * a name field has a placeholder. What that argument missed is that the
     * name belongs to the person it greets every morning — and half of them
     * want to say "JARVIS". It is stored empty by default, so an untouched
     * install still has one name everywhere, and an empty string resets it.
     */
    description:
      "Read or change who the user is — their name, how to address them (Sir/Mam), their city, their language — and what the assistant itself is called. Takes effect on the very next reply. Pass an empty assistantName to go back to the default.",
    parameters: object({
      userName: { type: "string", description: "What to call the user." },
      gender: { type: "string", description: "'male' for Sir, 'female' for Mam, or anything else for neither." },
      city: { type: "string", description: "Where they are, used for weather." },
      language: { type: "string", description: "The language they speak." },
      assistantName: {
        type: "string",
        description: "What the assistant should be called. Empty string restores the default.",
      },
    }),
    mutating: true,
    risk: "low",
  },
  {
    name: "memory_preference",
    domain: "conversation",
    /*
     * SEPARATE FROM `memory_remember` BECAUSE THEY EXPIRE DIFFERENTLY. A
     * preference is permanent and small — "plain answers, no hedging" — and
     * belongs in front of the model on every turn. A fact is an observation
     * that may stop being true and is recalled on demand. Collapsing them means
     * either the preferences get lost in a list of facts or the facts never
     * expire.
     */
    description:
      "Read how the user likes things done, or record a new preference — tone, length, format, anything about HOW rather than WHAT. Preferences are permanent and go in front of the model every session. Call with no arguments to read them all.",
    parameters: object({
      key: { type: "string", description: "One or two words naming the preference, e.g. 'tone'." },
      value: { type: "string", description: "What they prefer." },
    }),
    mutating: true,
    risk: "low",
  },
  {
    name: "memory_snapshot",
    domain: "conversation",
    description:
      "Everything OCADE currently remembers: who the user is, their preferences, active projects, remembered facts and watched topics.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "session_summarise",
    domain: "conversation",
    /*
     * WRITTEN AT THE END, CONSUMED ONCE, THEN GONE.
     *
     * The engine marks a summary used the moment a briefing mentions it, which
     * is the whole reason tomorrow's briefing is about tomorrow. A summary
     * written twice for the same conversation is therefore harmless but
     * pointless, and the description says "at the end" so it is not called
     * mid-task on a conversation that has not finished happening.
     */
    description:
      "Write one or two sentences about this conversation so tomorrow's briefing can mention it. Call this at the END of a session. It is mentioned once and then permanently consumed, so it never repeats.",
    parameters: object(
      {
        summary: { type: "string", description: "One or two sentences about what happened." },
        topics: {
          type: "array",
          description: "Optional short topic words.",
          items: { type: "string" },
        },
      },
      ["summary"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "morning_briefing",
    domain: "conversation",
    description:
      "Greet the user, say the time and date, recap what they were working on yesterday, name their open projects, and read today's headlines. Use this when the user asks to be caught up, or on the first exchange of a new day.",
    parameters: object({
      news: { type: "string", description: "'no' to skip the headlines.", enum: ["yes", "no"] },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "proactive_check",
    domain: "conversation",
    /*
     * ANSWERING "NOTHING" IS THE COMMON CASE AND THE CORRECT ONE, and the
     * description has to say so or the model will manufacture a line rather
     * than report the silence. The engine has a twenty-minute cooldown and will
     * return `speak: false` most of the time by design.
     */
    description:
      "Ask whether OCADE has anything worth saying unprompted right now — a project gone quiet, a watched topic that moved, a thread left open. It usually returns nothing, and nothing is the right answer; do not invent a line when it does.",
    parameters: object({
      recentTopics: {
        type: "array",
        description: "Optional. What has been discussed recently.",
        items: { type: "string" },
      },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "topic_watch",
    domain: "conversation",
    description:
      "Follow a subject in the background. OCADE checks it at most once a day and only speaks when the headline actually changes. Call with no topic to list what is being watched.",
    parameters: object({
      topic: { type: "string", description: "The subject to follow. Omit to list." },
      stop: { type: "string", description: "'yes' to stop watching this topic.", enum: ["yes", "no"] },
    }),
    mutating: true,
    risk: "low",
  },
  {
    name: "topic_check",
    domain: "conversation",
    description:
      "Check the watched topics for news now, and report only what has genuinely changed since last time.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "language_note",
    domain: "conversation",
    /*
     * SILENT BY DESIGN — see `core/os_control.language`. The first transcription
     * names a language, that is stored, and every later session adapts. It is
     * NOT overwritten on a single differing sample, because one sentence in
     * another language is a quote or a song title, not a change of language.
     */
    description:
      "Record the language the user is speaking, learned by observation rather than by asking. Call this with the language of what they just said; OCADE keeps the first one it learns and adapts future sessions to it.",
    parameters: object({
      detected: { type: "string", description: "The language just heard, e.g. 'english'." },
    }),
    mutating: true,
    risk: "low",
  },
];

const REGISTRY: Record<Domain, ToolDefinition[]> = {
  os_app: OS_APP,
  files: FILES,
  web: WEB,
  conversation: CONTINUITY,
  // Declared so the shape is total. Populated as each layer is connected; an
  // empty domain loads no schemas, which is honest — better than advertising a
  // tool whose adapter would refuse.
  content: [],
  connectors: [],
  cross_device: [],
};

export function toolsFor(domains: readonly Domain[]): ToolDefinition[] {
  const seen = new Set<string>();
  const out: ToolDefinition[] = [];
  for (const domain of domains) {
    for (const tool of REGISTRY[domain] ?? []) {
      if (seen.has(tool.name)) continue;
      seen.add(tool.name);
      out.push(tool);
    }
  }
  return out;
}

/** The wire format both Ollama and OpenAI-compatible runtimes accept. */
export interface WireTool {
  type: "function";
  function: { name: string; description: string; parameters: ToolParameterSchema };
}

export function schemasFor(domains: readonly Domain[]): WireTool[] {
  return toolsFor(domains).map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

export function findTool(name: string): ToolDefinition | null {
  for (const domain of Object.keys(REGISTRY) as Domain[]) {
    const hit = REGISTRY[domain].find((tool) => tool.name === name);
    if (hit) return hit;
  }
  return null;
}

/** Every tool name in the catalogue. Used by tests to assert wiring. */
export function allToolNames(): string[] {
  return (Object.keys(REGISTRY) as Domain[]).flatMap((d) => REGISTRY[d].map((t) => t.name));
}
