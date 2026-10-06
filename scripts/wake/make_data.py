"""
OCADE wake-phrase training data, made on this computer (owner direction 2026-10-02).

Sources, all local and none downloaded: Windows' own speech voices (OneCore and desktop
SAPI), which this computer's Windows licence lets it use, speaking text OCADE writes; and
the Windows Media sound files already on the machine. Noise and music-like backgrounds are
generated in training. Nothing here comes from Hugging Face or any model hub.

The corpus stays OUT of the repository and out of every product package:
    python scripts/wake/make_data.py --out %LOCALAPPDATA%/ocade-wake-data
It writes provenance.json beside the audio: every voice, text and prosody used.
"""
from __future__ import annotations

import argparse
import itertools
import json
import random
import subprocess
import sys
from pathlib import Path

VOICES = {  # name: (language, gender, accent) — every English voice on this computer
    "Microsoft Ravi": ("en-IN", "male", "Indian English"),
    "Microsoft Heera": ("en-IN", "female", "Indian English"),
    "Microsoft George": ("en-GB", "male", "British English"),
    "Microsoft Hazel": ("en-GB", "female", "British English"),
    "Microsoft Susan": ("en-GB", "female", "British English"),
    "Microsoft Zira Desktop": ("en-US", "female", "American English"),
    "Microsoft Hazel Desktop": ("en-GB", "female", "British English"),
}
# OCADE is said "OH-kayd" (src/lib/public-identity.ts). Several ways of asking for it,
# so the model learns the word and not one engine's reading of one spelling.
PRONUNCIATIONS = {
    "ipa_first": '<phoneme alphabet="ipa" ph="&#x2C8;o&#x28A;ke&#x26A;d">OCADE</phoneme>',
    "ipa_second": '<phoneme alphabet="ipa" ph="o&#x28A;&#x2C8;ke&#x26A;d">OCADE</phoneme>',
    "spelled_oh": "Oh-kade",
    "spelled_okay": "Okayd",
}
FORMS = {"ocade": "{p}", "hey_ocade": "Hey {p}", "hey_pause_ocade": "Hey, {p}"}
RATES = ["0.75", "0.85", "1.0", "1.1", "1.2", "1.3"]
PITCHES = ["-12%", "-6%", "+0%", "+5%", "+10%", "+15%"]

# Words and phrases that sound close to the wake phrase, or are other assistants' names.
HARD = [
    "okay", "Hey okay", "arcade", "Hey arcade", "cascade", "decade", "a cave", "oh cake", "okay did",
    "Hey Kate", "Hey Cade", "Hey Jade", "Hey Kay", "Hey OK", "Ocado", "Hey Ocado", "Oakland",
    "occupied", "accolade", "lemonade", "barricade", "brigade", "escapade", "masquerade", "blockade",
    "Hey Google", "OK Google", "Alexa", "Hey Siri", "Hey Jarvis", "Hey Cortana", "Hey there",
    "oh, okay", "oh no", "okay then", "a code", "the code", "encode", "decode", "Hey Claude",
    "Hey, are you there", "O'Kane", "okra", "Okay, I'm here", "hey, okay, wait",
]
SUBJECTS = ["I", "We", "My sister", "The manager", "Our team", "You", "They", "The doctor", "Priya",
            "Rahul", "My friend", "The teacher", "Everyone", "The new intern", "Grandma"]
VERBS = ["opened", "finished", "sent", "printed", "checked", "moved", "cancelled", "booked", "fixed",
         "shared", "deleted", "renamed", "downloaded", "watched", "cooked", "signed", "called"]
OBJECTS = ["the report", "the spreadsheet", "an email", "the meeting", "the invoice", "the photos",
           "the train tickets", "the slides", "the budget", "a cake", "the window", "the video",
           "the contract", "the presentation", "the grocery list", "the music playlist"]
WHEN = ["this morning", "yesterday", "last week", "after lunch", "on Monday", "before the call",
        "at five o'clock", "in the evening", "right now", "twice today", "around noon"]
EXTRA = ["Can you turn the volume down?", "What time is the match tonight?", "Please call me back later.",
         "The weather in Chennai is hot today.", "Let's order some pizza.", "I think the code is broken.",
         "Did you see the cricket score?", "The bus is running late again.", "Put the kettle on, please.",
         "Remind me to water the plants.", "The movie starts at nine thirty.", "Where did I keep my keys?"]


def ssml(voice: str, body: str, rate: str, pitch: str) -> str:
    lang = VOICES[voice][0]
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{lang}">'
            f'<prosody rate="{rate}" pitch="{pitch}">{body}</prosody></speak>')


def jobs(out: Path, seed: int) -> list[dict]:
    rng = random.Random(seed)
    made = []
    for voice, (form, text), (pron, said) in itertools.product(
            VOICES, FORMS.items(), PRONUNCIATIONS.items()):
        for rate, pitch in rng.sample(list(itertools.product(RATES, PITCHES)), 8):
            name = f"pos_{form}_{pron}_{voice.split()[1].lower()}{'d' if 'Desktop' in voice else ''}_{rate}_{pitch}"
            made.append({"file": str(out / "positive" / f"{name}.wav"), "voice": voice, "label": 1,
                         "form": form, "pronunciation": pron, "rate": rate, "pitch": pitch,
                         "ssml": ssml(voice, text.format(p=said), rate, pitch)})
    for index, text in enumerate(HARD):
        for voice in VOICES:
            rate, pitch = rng.choice(RATES), rng.choice(PITCHES)
            made.append({"file": str(out / "negative" / f"hard_{index}_{voice.split()[1].lower()}"
                                                            f"{'d' if 'Desktop' in voice else ''}.wav"),
                         "voice": voice, "label": 0, "kind": "hard", "text": text, "rate": rate,
                         "pitch": pitch, "ssml": ssml(voice, text, rate, pitch)})
    sentences = [f"{rng.choice(SUBJECTS)} {rng.choice(VERBS)} {rng.choice(OBJECTS)} {rng.choice(WHEN)}."
                 for _ in range(500)] + EXTRA * 4
    for index, text in enumerate(sentences):
        voice, rate, pitch = rng.choice(list(VOICES)), rng.choice(RATES), rng.choice(PITCHES)
        # The voice is in the name, as for every other clip, so a held-out speaker's
        # ordinary speech stays out of training (F-017).
        tag = f"{voice.split()[1].lower()}{'d' if 'Desktop' in voice else ''}"
        made.append({"file": str(out / "negative" / f"speech_{index}_{tag}.wav"), "voice": voice, "label": 0,
                     "kind": "speech", "text": text, "rate": rate, "pitch": pitch,
                     "ssml": ssml(voice, text, rate, pitch)})
    return made


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20261002)
    args = parser.parse_args()
    out = Path(args.out)
    (out / "positive").mkdir(parents=True, exist_ok=True)
    (out / "negative").mkdir(parents=True, exist_ok=True)
    all_jobs = jobs(out, args.seed)
    script = Path(__file__).with_name("synthesize.ps1")
    shards = [all_jobs[i::args.workers] for i in range(args.workers)]
    running = []
    for n, shard in enumerate(shards):
        listing = out / f"jobs_{n}.json"
        listing.write_text(json.dumps([{k: j[k] for k in ("file", "voice", "ssml")} for j in shard]),
                           encoding="utf-8")
        running.append(subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                                         str(script), "-Jobs", str(listing)]))
    for process in running:
        process.wait()
    present = [j for j in all_jobs if Path(j["file"]).exists()]
    media = sorted(str(p) for p in Path("C:/Windows/Media").rglob("*.wav"))
    provenance = {
        "made_with": "Windows speech voices on this computer (OneCore and desktop SAPI); no download",
        "voices": {name: {"language": v[0], "gender": v[1], "accent": v[2]} for name, v in VOICES.items()},
        "clips": [{k: v for k, v in j.items() if k != "ssml"} for j in present],
        "background_files": media,
        "background_generated": "white, pink and brown noise; tone and chord sequences (in training)",
        "not_used": "Hugging Face or any model or dataset hub",
    }
    (out / "provenance.json").write_text(json.dumps(provenance, indent=1), encoding="utf-8")
    positives = sum(1 for j in present if j["label"] == 1)
    print(f"{positives} positive and {len(present) - positives} negative clips of {len(all_jobs)} asked; "
          f"{len(media)} Windows Media files")


if __name__ == "__main__":
    sys.exit(main())
