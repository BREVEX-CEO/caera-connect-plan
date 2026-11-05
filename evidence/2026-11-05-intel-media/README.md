# Intel macOS CI media bootstrap

The required Intel companion matrix repeatedly exhausted its 50-minute job
budget before running tests. Job 126842629832 in run 41904905940 shows Homebrew
building ffmpeg dependencies from source, including a Python build lasting
about 16 minutes. Extending the deadline would retain that variable bootstrap;
removing media tests would weaken qualification. Instead, only the disposable
Intel test runner uses fixed upstream static ffmpeg and ffprobe archives.
Customer dependencies and the shipped installer are unchanged.

## Independent publisher verification

Cloud probe candidate `37713099de15b220ec3698ec9eff259b483907e0`,
[run 41917264482](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41917264482),
Linux core job 126882064253, downloads both publisher archives and detached
signatures. GPG reports good signatures for both, using the pinned fingerprint
`20F6EA3E0CFD6B4C53447A73476C4B611A660874` from
https://evermeet.cx/ffmpeg/0x1A660874.asc. The job independently computes:

| Archive | Bytes | SHA-256 |
|---|---:|---|
| https://evermeet.cx/ffmpeg/ffmpeg-9.0.2.zip | 26198325 | 4acc0be580f9b2788029eb7bd4d645ff87968911b0a62aeeb3940d42d54558d5 |
| https://evermeet.cx/ffmpeg/ffprobe-9.0.2.zip | 26104193 | 24a9c968cd4da72d99c7245e914b921815835eb6dff01d99868031aebaf1d439 |

The publisher identifies these Intel static builds as GPLv3. They are test-runner
tools only and are not copied to OCADE distributions. The bootstrap pins the
verified archive hashes, bounds downloads, reads only the expected ZIP member,
checks the actual Mach-O architecture and executes both version probes before
adding their private runner directory to PATH. No archive path is extracted.
Homebrew continues to provide LibreOffice; ARM64 keeps its existing ffmpeg
installation. Actual companion media tests remain required without new skips.

Native Intel execution and the complete matrix are pending the workflow
bootstrap change. This record earns no consumer-platform or release PASS.
