# Intel scene readback and popup qualification failures

Published baseline `aaf3bad3fe3c8c8c6154d45937132fdfa850b752`,
[run 41970810529](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41970810529),
passes nine jobs. Intel job 127061543475 reaches all 162 companion tests and
fails `test_scene_render_is_bound_to_its_saved_project`: the independent saved
image has one gray level, while the operation and its existing scene/hash/size
checks reported success. The original image assertion requires more than 20
gray levels; it is retained. This is D28, a real render/readback defect, not a
media-bootstrap timeout. Both pinned Intel media executables actually execute
and report their verified hashes and x86_64 architecture in this job.

The integrated repair candidate `26ec426b4eec83e2b7d822e476af7142d2723254`,
run 41971524885, also passes nine jobs. Intel job 127064311487 fails the same
image assertion and additionally reports an empty off-site popup classification
in WEB-009 (expected `closed_off_site`). That is D29. The existing browser click
collector has a fixed 500 ms window; its involvement is a hypothesis, not a
proven cause of this intermittent Intel failure. Site request-binding tests
remain separate; this failure does not establish that an off-site request was
allowed. Neither failure is removed or accepted as a platform PASS.

## Controlled render investigation

The first manual probe, run 41973909397, did not export its installed browser
path, so its render case skipped. It is not render proof and was stopped.
The corrected probe requires exactly one case and zero skips.

At `de1a3f029cb49cbf60b24f128ee89fd0eff53b48`, run 41974425572:

- ARM64 job 127069929231 runs the actual render/glTF case successfully, with
  ANGLE Metal on the Apple Paravirtual device and 11,500 saved mesh triangles.
- Intel job 127069929307 fails closed with `no_3d_engine` after the new WebGL
  draw/readback error check. No flat output is reported as success in this
  probe. The public error omits the underlying GPU detail, so the exact native
  cause still needs bounded internal diagnostics.

These are explicitly unpublished diagnostic candidates. Their temporary build
specification deliberately stops after the one render case; a red package job
that says the diagnostic passed is not a package qualification result. The
normal feature specification contains no diagnostic stop. Investigation now
retains a bounded engine-failure detail on stderr. No unsafe graphics flag,
sandbox relaxation or test threshold change is introduced to obtain a PASS.
