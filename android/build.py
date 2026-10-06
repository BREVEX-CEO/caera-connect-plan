"""
Build OCADE for Android with the Android SDK's own tools: no Gradle, no
libraries, only the platform's framework.

    python android/build.py            # a debuggable test build, signed with a local test key
    python android/build.py --release  # not debuggable; needs the owner's release keystore

The APK lands in android/build/. The test key lives beside the Device Agent's
release key (~/.ocade-release/), never in the repository.
"""
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SDK = Path(os.environ.get("ANDROID_HOME") or Path(os.environ["LOCALAPPDATA"]) / "Android" / "Sdk")


def newest(folder: Path) -> Path:
    """android-35 over android-9 and 35.0.0 over 9.0.0: versions compare as numbers, not text."""
    return max((p for p in folder.iterdir() if re.search(r"\d", p.name)),
               key=lambda p: tuple(int(n) for n in re.findall(r"\d+", p.name)))


TOOLS = newest(SDK / "build-tools")
PLATFORM = newest(SDK / "platforms") / "android.jar"
JDK = Path(os.environ.get("JAVA_HOME") or r"C:\Program Files\Android\Android Studio\jbr")
EXE = ".exe" if os.name == "nt" else ""
BAT = ".bat" if os.name == "nt" else ""
KEYS = Path.home() / ".ocade-release"


def run(*command: str | Path) -> None:
    done = subprocess.run([str(c) for c in command], capture_output=True, text=True)
    if done.returncode != 0:
        sys.exit(f"{Path(str(command[0])).name} failed:\n{done.stdout}\n{done.stderr}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", action="store_true")
    args = parser.parse_args()
    out = HERE / "build"
    shutil.rmtree(out, ignore_errors=True)
    (out / "res" / "mipmap-xxxhdpi").mkdir(parents=True)
    shutil.copytree(HERE / "res", out / "res", dirs_exist_ok=True)
    if args.release:
        # A release build talks HTTPS only: the emulator's plain-HTTP exception is a test build's.
        (out / "res" / "xml" / "network.xml").write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n'
            '    <base-config cleartextTrafficPermitted="false" />\n</network-security-config>\n',
            encoding="utf-8")
    shutil.copy(ROOT / "public" / "icons" / "ocade-192.png", out / "res" / "mipmap-xxxhdpi" / "ic_launcher.png")
    # One protocol for every OCADE device: the server, the Device Agent and this app read the same file.
    (out / "assets").mkdir()
    shutil.copy(ROOT / "jarvis-runtime" / "ocade_protocol.json", out / "assets" / "ocade_protocol.json")
    # OCADE's wake model and its signed manifest: the same files the Device Agent bundles, checked by
    # the same authority (ocade_update) before they go in. On the phone the APK signature keeps them so.
    (out / "assets" / "wake").mkdir()
    wake = ROOT / "jarvis-runtime" / "wake"
    sys.path.insert(0, str(ROOT / "jarvis-runtime"))
    import ocade_wake
    try:
        manifest = ocade_wake.verify(wake)
    except ocade_wake.WakeUnavailable as error:
        sys.exit(f"Not packaging the wake model: {error}")
    for name in ("manifest.json", "manifest.sig", manifest["file"]):
        shutil.copy(wake / name, out / "assets" / "wake" / name)

    run(TOOLS / f"aapt2{EXE}", "compile", "--dir", out / "res", "-o", out / "res.zip")
    link = [TOOLS / f"aapt2{EXE}", "link", "-I", PLATFORM, "--manifest", HERE / "AndroidManifest.xml",
            "-o", out / "base.apk", "-A", out / "assets", "--java", out / "gen", "--auto-add-overlay",
            out / "res.zip"]
    if not args.release:
        link.insert(2, "--debug-mode")
    run(*link)

    sources = glob.glob(str(HERE / "src" / "**" / "*.java"), recursive=True) + \
        glob.glob(str(out / "gen" / "**" / "*.java"), recursive=True)
    run(JDK / "bin" / f"javac{EXE}", "-source", "17", "-target", "17", "-nowarn", "-Xlint:-options",
        "-encoding", "UTF-8", "-cp", PLATFORM, "-d", out / "classes", *sources)
    classes = glob.glob(str(out / "classes" / "**" / "*.class"), recursive=True)
    (out / "dex").mkdir()
    run(TOOLS / f"d8{BAT}", "--min-api", "30", "--lib", PLATFORM, "--output", out / "dex",
        *([] if args.release else ["--debug"]), *classes)

    shutil.copy(out / "base.apk", out / "unaligned.apk")
    with zipfile.ZipFile(out / "unaligned.apk", "a") as apk:
        apk.write(out / "dex" / "classes.dex", "classes.dex")
    run(TOOLS / f"zipalign{EXE}", "-f", "4", out / "unaligned.apk", out / "aligned.apk")

    if args.release:
        keystore = KEYS / "android-release.keystore"
        if not keystore.exists():
            sys.exit("The release keystore is the owner's to make and keep; it is not here.")
        password = os.environ.get("OCADE_ANDROID_KEY_PASSWORD")
        if not password:
            sys.exit("Set OCADE_ANDROID_KEY_PASSWORD for the release keystore.")
        name = "OCADE-release.apk"
    else:
        keystore = KEYS / "android-test.keystore"
        password = "ocade-test"
        if not keystore.exists():
            KEYS.mkdir(exist_ok=True)
            run(JDK / "bin" / f"keytool{EXE}", "-genkeypair", "-keystore", keystore, "-alias", "ocade-test",
                "-keyalg", "EC", "-groupname", "secp256r1", "-validity", "10000", "-storepass", password,
                "-keypass", password, "-dname", "CN=OCADE test build")
        name = "OCADE-test.apk"
    run(TOOLS / f"apksigner{BAT}", "sign", "--ks", keystore, "--ks-pass", f"pass:{password}",
        "--key-pass", f"pass:{password}", "--out", out / name, out / "aligned.apk")
    print(out / name)


if __name__ == "__main__":
    main()
