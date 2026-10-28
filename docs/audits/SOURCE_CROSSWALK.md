# Source crosswalk — qualification dispositions, 28 October 2026

Derived from `plan.md` at `71e8b637a5f723a33593a39f73d6cccd3573e945`, not a replacement roadmap or a claim that every line of code was audited. The source contains exactly **200 original IDs, 561 research IDs and 190 supplied supplement rows across A–J**. Source-number gaps remain gaps. [Canonical work queue](../../BLOCKED_TESTS.md#cloud-safety-continuation--28-october-2026) and [test evidence](TEST_EVIDENCE.md) own continuation.

**Status meaning:** current commercial qualification of the source item, not a declaration that its entire implementation is missing. `BLOCKED Q` means exact-candidate cloud execution, complete source-to-test mapping and independent outcome evidence are absent; a historical PASS cannot qualify this changed candidate. Research observations remain a queue for semantic classification; they are not automatically defects or completed features. No item receives PASS from inventory metadata, source review or a mocked check. Owner: OCADE principal engineering team, with external approvals identified in the work queue.

`FAIL S` marks a currently source-confirmed unmet safety contract: #10 (RC08 uncancellable upload), #12 (known parser dependency advisories), #121 (RC15 Windows commands lack OS filesystem confinement). Exploitability and native effects were not demonstrated. All other items remain `BLOCKED Q`; no unsupported N/A exemptions were invented.

## Original requirements

| ID | Master-plan source | Phase | Current disposition |
| --- | --- | --- | --- |
| 1 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L325) | 01 | BLOCKED Q |
| 2 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L326) | 01 | BLOCKED Q |
| 3 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L327) | 01 | BLOCKED Q |
| 4 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L328) | 01 | BLOCKED Q |
| 5 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L329) | 01 | BLOCKED Q |
| 6 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L330) | 01 | BLOCKED Q |
| 7 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L331) | 01 | BLOCKED Q |
| 8 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L332) | 01 | BLOCKED Q |
| 9 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L333) | 01 | BLOCKED Q |
| 10 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L334) | 01 | FAIL S |
| 11 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L335) | 01 | BLOCKED Q |
| 12 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L336) | 01 | FAIL S |
| 13 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L337) | 07 | BLOCKED Q |
| 14 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L338) | 07 | BLOCKED Q |
| 15 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L339) | 07 | BLOCKED Q |
| 16 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L340) | 07 | BLOCKED Q |
| 17 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L341) | 07 | BLOCKED Q |
| 18 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L342) | 07 | BLOCKED Q |
| 19 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L343) | 07 | BLOCKED Q |
| 20 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L344) | 07 | BLOCKED Q |
| 21 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L345) | 07 | BLOCKED Q |
| 22 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L346) | 07 | BLOCKED Q |
| 23 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L347) | 07 | BLOCKED Q |
| 24 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L348) | 07 | BLOCKED Q |
| 25 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L349) | 02–06 | BLOCKED Q |
| 26 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L350) | 02–06 | BLOCKED Q |
| 27 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L351) | 02–06 | BLOCKED Q |
| 28 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L352) | 02–06 | BLOCKED Q |
| 29 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L353) | 02–06 | BLOCKED Q |
| 30 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L354) | 02–06 | BLOCKED Q |
| 31 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L355) | 02–06 | BLOCKED Q |
| 32 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L356) | 02–06 | BLOCKED Q |
| 33 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L357) | 02–06 | BLOCKED Q |
| 34 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L358) | 02–06 | BLOCKED Q |
| 35 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L359) | 02–06 | BLOCKED Q |
| 36 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L360) | 02–06 | BLOCKED Q |
| 37 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L361) | 02–06 | BLOCKED Q |
| 38 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L362) | 02–06 | BLOCKED Q |
| 39 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L363) | 02–06 | BLOCKED Q |
| 40 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L364) | 02–06 | BLOCKED Q |
| 41 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L365) | 02–06 | BLOCKED Q |
| 42 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L366) | 02–06 | BLOCKED Q |
| 43 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L367) | 02–06 | BLOCKED Q |
| 44 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L368) | 02–06 | BLOCKED Q |
| 45 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L369) | 07–08 | BLOCKED Q |
| 46 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L370) | 07–08 | BLOCKED Q |
| 47 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L371) | 07–08 | BLOCKED Q |
| 48 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L372) | 07–08 | BLOCKED Q |
| 49 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L373) | 07–08 | BLOCKED Q |
| 50 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L374) | 07–08 | BLOCKED Q |
| 51 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L375) | 07–08 | BLOCKED Q |
| 52 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L376) | 07–08 | BLOCKED Q |
| 53 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L377) | 07–08 | BLOCKED Q |
| 54 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L378) | 07–08 | BLOCKED Q |
| 55 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L379) | 07–08 | BLOCKED Q |
| 56 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L380) | 07–08 | BLOCKED Q |
| 57 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L381) | 07–08 | BLOCKED Q |
| 58 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L382) | 05 | BLOCKED Q |
| 59 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L383) | 05 | BLOCKED Q |
| 60 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L384) | 05 | BLOCKED Q |
| 61 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L385) | 05 | BLOCKED Q |
| 62 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L386) | 05 | BLOCKED Q |
| 63 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L387) | 05 | BLOCKED Q |
| 64 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L388) | 05 | BLOCKED Q |
| 65 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L389) | 05 | BLOCKED Q |
| 66 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L390) | 05 | BLOCKED Q |
| 67 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L391) | 05 | BLOCKED Q |
| 68 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L392) | 05 | BLOCKED Q |
| 69 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L393) | 05 | BLOCKED Q |
| 70 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L394) | 05 | BLOCKED Q |
| 71 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L395) | 05 | BLOCKED Q |
| 72 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L396) | 05 | BLOCKED Q |
| 73 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L397) | 05 | BLOCKED Q |
| 74 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L398) | 05 | BLOCKED Q |
| 75 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L399) | 07 | BLOCKED Q |
| 76 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L400) | 07 | BLOCKED Q |
| 77 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L401) | 07 | BLOCKED Q |
| 78 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L402) | 07 | BLOCKED Q |
| 79 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L403) | 07 | BLOCKED Q |
| 80 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L404) | 07 | BLOCKED Q |
| 81 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L405) | 07 | BLOCKED Q |
| 82 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L406) | 07 | BLOCKED Q |
| 83 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L407) | 07 | BLOCKED Q |
| 84 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L408) | 07 | BLOCKED Q |
| 85 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L409) | 07 | BLOCKED Q |
| 86 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L410) | 10 | BLOCKED Q |
| 87 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L411) | 10 | BLOCKED Q |
| 88 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L412) | 10 | BLOCKED Q |
| 89 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L413) | 10 | BLOCKED Q |
| 90 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L414) | 10 | BLOCKED Q |
| 91 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L415) | 10 | BLOCKED Q |
| 92 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L416) | 10 | BLOCKED Q |
| 93 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L417) | 10 | BLOCKED Q |
| 94 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L418) | 10 | BLOCKED Q |
| 95 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L419) | 10 | BLOCKED Q |
| 96 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L420) | 10 | BLOCKED Q |
| 97 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L421) | 10 | BLOCKED Q |
| 98 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L422) | 10 | BLOCKED Q |
| 99 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L423) | 10 | BLOCKED Q |
| 100 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L424) | 10 | BLOCKED Q |
| 101 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L425) | 08 | BLOCKED Q |
| 102 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L426) | 08 | BLOCKED Q |
| 103 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L427) | 08 | BLOCKED Q |
| 104 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L428) | 08 | BLOCKED Q |
| 105 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L429) | 08 | BLOCKED Q |
| 106 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L430) | 08 | BLOCKED Q |
| 107 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L431) | 08 | BLOCKED Q |
| 108 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L432) | 08 | BLOCKED Q |
| 109 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L433) | 08 | BLOCKED Q |
| 110 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L434) | 08 | BLOCKED Q |
| 111 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L435) | 08 | BLOCKED Q |
| 112 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L436) | 08 | BLOCKED Q |
| 113 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L437) | 08 | BLOCKED Q |
| 114 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L438) | 09 | BLOCKED Q |
| 115 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L439) | 09 | BLOCKED Q |
| 116 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L440) | 09 | BLOCKED Q |
| 117 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L441) | 09 | BLOCKED Q |
| 118 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L442) | 09 | BLOCKED Q |
| 119 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L443) | 09 | BLOCKED Q |
| 120 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L444) | 09 | BLOCKED Q |
| 121 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L445) | 09 | FAIL S |
| 122 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L446) | 09 | BLOCKED Q |
| 123 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L447) | 09 | BLOCKED Q |
| 124 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L448) | 09 | BLOCKED Q |
| 125 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L449) | 09 | BLOCKED Q |
| 126 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L450) | 09 | BLOCKED Q |
| 127 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L451) | 09 | BLOCKED Q |
| 128 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L452) | 09 | BLOCKED Q |
| 129 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L453) | 09 | BLOCKED Q |
| 130 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L454) | 09 | BLOCKED Q |
| 131 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L455) | 11 | BLOCKED Q |
| 132 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L456) | 11 | BLOCKED Q |
| 133 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L457) | 11 | BLOCKED Q |
| 134 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L458) | 11 | BLOCKED Q |
| 135 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L459) | 11 | BLOCKED Q |
| 136 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L460) | 11 | BLOCKED Q |
| 137 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L461) | 11 | BLOCKED Q |
| 138 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L462) | 11 | BLOCKED Q |
| 139 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L463) | 11 | BLOCKED Q |
| 140 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L464) | 11 | BLOCKED Q |
| 141 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L465) | 11 | BLOCKED Q |
| 142 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L466) | 11 | BLOCKED Q |
| 143 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L467) | 11 | BLOCKED Q |
| 144 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L468) | 11 | BLOCKED Q |
| 145 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L469) | 12 | BLOCKED Q |
| 146 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L470) | 12 | BLOCKED Q |
| 147 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L471) | 12 | BLOCKED Q |
| 148 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L472) | 12 | BLOCKED Q |
| 149 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L473) | 12 | BLOCKED Q |
| 150 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L474) | 12 | BLOCKED Q |
| 151 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L475) | 12 | BLOCKED Q |
| 152 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L476) | 12 | BLOCKED Q |
| 153 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L477) | 12 | BLOCKED Q |
| 154 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L478) | 12 | BLOCKED Q |
| 155 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L479) | 12 | BLOCKED Q |
| 156 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L480) | 12 | BLOCKED Q |
| 157 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L481) | 12 | BLOCKED Q |
| 158 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L482) | 12 | BLOCKED Q |
| 159 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L483) | 12 | BLOCKED Q |
| 160 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L484) | 12 | BLOCKED Q |
| 161 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L485) | 12 | BLOCKED Q |
| 162 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L486) | 12 | BLOCKED Q |
| 163 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L487) | 12 | BLOCKED Q |
| 164 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L488) | 12 | BLOCKED Q |
| 165 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L489) | 12 | BLOCKED Q |
| 166 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L490) | 12 | BLOCKED Q |
| 167 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L491) | 12 | BLOCKED Q |
| 168 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L492) | 12 | BLOCKED Q |
| 169 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L493) | 12 | BLOCKED Q |
| 170 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L494) | 12 | BLOCKED Q |
| 171 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L495) | 12 | BLOCKED Q |
| 172 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L496) | 12 | BLOCKED Q |
| 173 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L497) | 12 | BLOCKED Q |
| 174 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L498) | 12 | BLOCKED Q |
| 175 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L499) | 11–13 | BLOCKED Q |
| 176 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L500) | 11–13 | BLOCKED Q |
| 177 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L501) | 11–13 | BLOCKED Q |
| 178 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L502) | 11–13 | BLOCKED Q |
| 179 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L503) | 11–13 | BLOCKED Q |
| 180 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L504) | 11–13 | BLOCKED Q |
| 181 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L505) | 11–13 | BLOCKED Q |
| 182 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L506) | 11–13 | BLOCKED Q |
| 183 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L507) | 11–13 | BLOCKED Q |
| 184 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L508) | 11–13 | BLOCKED Q |
| 185 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L509) | 11–13 | BLOCKED Q |
| 186 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L510) | 11–13 | BLOCKED Q |
| 187 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L511) | 11–13 | BLOCKED Q |
| 188 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L512) | 11–13 | BLOCKED Q |
| 189 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L513) | 11–13 | BLOCKED Q |
| 190 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L514) | 12–13 | BLOCKED Q |
| 191 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L515) | 12–13 | BLOCKED Q |
| 192 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L516) | 12–13 | BLOCKED Q |
| 193 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L517) | 12–13 | BLOCKED Q |
| 194 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L518) | 12–13 | BLOCKED Q |
| 195 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L519) | 12–13 | BLOCKED Q |
| 196 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L520) | 12–13 | BLOCKED Q |
| 197 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L521) | 12–13 | BLOCKED Q |
| 198 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L522) | 12–13 | BLOCKED Q |
| 199 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L523) | 12–13 | BLOCKED Q |
| 200 | [original text](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L524) | 12–13 | BLOCKED Q |

## Supplied supplements

| ID | Master-plan source | Current disposition |
| --- | --- | --- |
| A-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L535) | BLOCKED Q |
| A-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L536) | BLOCKED Q |
| A-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L537) | BLOCKED Q |
| A-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L538) | BLOCKED Q |
| A-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L539) | BLOCKED Q |
| A-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L540) | BLOCKED Q |
| A-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L541) | BLOCKED Q |
| A-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L542) | BLOCKED Q |
| A-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L543) | BLOCKED Q |
| A-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L544) | BLOCKED Q |
| A-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L545) | BLOCKED Q |
| A-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L546) | BLOCKED Q |
| A-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L547) | BLOCKED Q |
| A-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L548) | BLOCKED Q |
| A-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L549) | BLOCKED Q |
| A-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L550) | BLOCKED Q |
| B-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L554) | BLOCKED Q |
| B-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L555) | BLOCKED Q |
| B-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L556) | BLOCKED Q |
| B-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L557) | BLOCKED Q |
| B-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L558) | BLOCKED Q |
| B-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L559) | BLOCKED Q |
| B-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L560) | BLOCKED Q |
| B-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L561) | BLOCKED Q |
| B-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L562) | BLOCKED Q |
| B-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L563) | BLOCKED Q |
| B-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L564) | BLOCKED Q |
| B-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L565) | BLOCKED Q |
| B-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L566) | BLOCKED Q |
| B-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L567) | BLOCKED Q |
| B-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L568) | BLOCKED Q |
| B-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L569) | BLOCKED Q |
| B-17 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L570) | BLOCKED Q |
| B-18 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L571) | BLOCKED Q |
| B-19 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L572) | BLOCKED Q |
| C-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L578) | BLOCKED Q |
| C-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L579) | BLOCKED Q |
| C-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L580) | BLOCKED Q |
| C-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L581) | BLOCKED Q |
| C-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L582) | BLOCKED Q |
| C-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L583) | BLOCKED Q |
| C-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L584) | BLOCKED Q |
| C-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L585) | BLOCKED Q |
| C-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L586) | BLOCKED Q |
| C-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L587) | BLOCKED Q |
| C-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L588) | BLOCKED Q |
| C-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L589) | BLOCKED Q |
| C-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L590) | BLOCKED Q |
| C-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L591) | BLOCKED Q |
| C-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L592) | BLOCKED Q |
| C-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L593) | BLOCKED Q |
| C-17 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L594) | BLOCKED Q |
| C-18 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L595) | BLOCKED Q |
| C-21 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L596) | BLOCKED Q |
| C-22 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L597) | BLOCKED Q |
| C-23 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L598) | BLOCKED Q |
| C-24 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L599) | BLOCKED Q |
| C-25 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L600) | BLOCKED Q |
| C-26 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L601) | BLOCKED Q |
| C-27 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L602) | BLOCKED Q |
| C-28 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L603) | BLOCKED Q |
| C-29 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L604) | BLOCKED Q |
| C-30 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L605) | BLOCKED Q |
| D-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L611) | BLOCKED Q |
| D-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L612) | BLOCKED Q |
| D-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L613) | BLOCKED Q |
| D-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L614) | BLOCKED Q |
| D-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L615) | BLOCKED Q |
| D-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L616) | BLOCKED Q |
| D-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L617) | BLOCKED Q |
| D-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L618) | BLOCKED Q |
| D-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L619) | BLOCKED Q |
| D-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L620) | BLOCKED Q |
| D-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L621) | BLOCKED Q |
| D-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L622) | BLOCKED Q |
| D-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L623) | BLOCKED Q |
| D-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L624) | BLOCKED Q |
| D-18 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L625) | BLOCKED Q |
| D-19 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L626) | BLOCKED Q |
| D-20 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L627) | BLOCKED Q |
| E-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L633) | BLOCKED Q |
| E-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L634) | BLOCKED Q |
| E-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L635) | BLOCKED Q |
| E-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L636) | BLOCKED Q |
| E-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L637) | BLOCKED Q |
| E-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L638) | BLOCKED Q |
| E-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L639) | BLOCKED Q |
| E-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L640) | BLOCKED Q |
| E-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L641) | BLOCKED Q |
| E-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L642) | BLOCKED Q |
| E-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L643) | BLOCKED Q |
| E-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L644) | BLOCKED Q |
| E-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L645) | BLOCKED Q |
| E-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L646) | BLOCKED Q |
| E-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L647) | BLOCKED Q |
| E-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L648) | BLOCKED Q |
| E-17 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L649) | BLOCKED Q |
| E-18 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L650) | BLOCKED Q |
| E-19 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L651) | BLOCKED Q |
| E-20 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L652) | BLOCKED Q |
| F-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L658) | BLOCKED Q |
| F-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L659) | BLOCKED Q |
| F-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L660) | BLOCKED Q |
| F-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L661) | BLOCKED Q |
| F-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L662) | BLOCKED Q |
| F-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L663) | BLOCKED Q |
| F-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L664) | BLOCKED Q |
| F-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L665) | BLOCKED Q |
| F-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L666) | BLOCKED Q |
| F-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L667) | BLOCKED Q |
| F-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L668) | BLOCKED Q |
| F-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L669) | BLOCKED Q |
| F-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L670) | BLOCKED Q |
| F-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L671) | BLOCKED Q |
| F-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L672) | BLOCKED Q |
| F-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L673) | BLOCKED Q |
| F-17 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L674) | BLOCKED Q |
| F-19 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L675) | BLOCKED Q |
| F-20 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L676) | BLOCKED Q |
| G-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L682) | BLOCKED Q |
| G-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L683) | BLOCKED Q |
| G-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L684) | BLOCKED Q |
| G-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L685) | BLOCKED Q |
| G-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L686) | BLOCKED Q |
| G-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L687) | BLOCKED Q |
| G-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L688) | BLOCKED Q |
| G-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L689) | BLOCKED Q |
| G-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L690) | BLOCKED Q |
| G-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L691) | BLOCKED Q |
| G-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L692) | BLOCKED Q |
| G-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L693) | BLOCKED Q |
| G-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L694) | BLOCKED Q |
| G-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L695) | BLOCKED Q |
| G-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L696) | BLOCKED Q |
| G-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L697) | BLOCKED Q |
| H-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L701) | BLOCKED Q |
| H-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L702) | BLOCKED Q |
| H-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L703) | BLOCKED Q |
| H-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L704) | BLOCKED Q |
| H-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L705) | BLOCKED Q |
| H-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L706) | BLOCKED Q |
| H-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L707) | BLOCKED Q |
| H-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L708) | BLOCKED Q |
| H-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L709) | BLOCKED Q |
| H-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L710) | BLOCKED Q |
| H-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L711) | BLOCKED Q |
| H-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L712) | BLOCKED Q |
| H-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L713) | BLOCKED Q |
| H-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L714) | BLOCKED Q |
| H-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L715) | BLOCKED Q |
| I-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L721) | BLOCKED Q |
| I-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L722) | BLOCKED Q |
| I-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L723) | BLOCKED Q |
| I-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L724) | BLOCKED Q |
| I-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L725) | BLOCKED Q |
| I-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L726) | BLOCKED Q |
| I-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L727) | BLOCKED Q |
| I-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L728) | BLOCKED Q |
| I-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L729) | BLOCKED Q |
| I-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L730) | BLOCKED Q |
| I-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L731) | BLOCKED Q |
| I-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L732) | BLOCKED Q |
| I-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L733) | BLOCKED Q |
| I-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L734) | BLOCKED Q |
| I-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L735) | BLOCKED Q |
| I-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L736) | BLOCKED Q |
| I-17 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L737) | BLOCKED Q |
| I-18 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L738) | BLOCKED Q |
| I-19 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L739) | BLOCKED Q |
| I-20 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L740) | BLOCKED Q |
| J-01 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L744) | BLOCKED Q |
| J-02 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L745) | BLOCKED Q |
| J-03 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L746) | BLOCKED Q |
| J-04 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L747) | BLOCKED Q |
| J-05 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L748) | BLOCKED Q |
| J-06 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L749) | BLOCKED Q |
| J-07 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L750) | BLOCKED Q |
| J-08 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L751) | BLOCKED Q |
| J-09 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L752) | BLOCKED Q |
| J-10 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L753) | BLOCKED Q |
| J-11 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L754) | BLOCKED Q |
| J-12 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L755) | BLOCKED Q |
| J-13 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L756) | BLOCKED Q |
| J-14 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L757) | BLOCKED Q |
| J-15 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L758) | BLOCKED Q |
| J-16 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L759) | BLOCKED Q |
| J-17 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L760) | BLOCKED Q |
| J-18 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L761) | BLOCKED Q |
| J-19 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L762) | BLOCKED Q |
| J-20 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L763) | BLOCKED Q |

## Research details

Every source ID is retained exactly once. Individual adapter choices and classifications need source-to-test review after the critical dependencies; this table does not assert that a named research tool must be installed.

| ID | Master-plan source | Current disposition |
| --- | --- | --- |
| R1-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L868) | BLOCKED Q |
| R1-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L869) | BLOCKED Q |
| R1-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L870) | BLOCKED Q |
| R1-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L871) | BLOCKED Q |
| R1-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L872) | BLOCKED Q |
| R1-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L873) | BLOCKED Q |
| R1-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L874) | BLOCKED Q |
| R1-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L875) | BLOCKED Q |
| R1-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L876) | BLOCKED Q |
| R1-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L877) | BLOCKED Q |
| R1-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L878) | BLOCKED Q |
| R1-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L879) | BLOCKED Q |
| R1-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L880) | BLOCKED Q |
| R1-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L881) | BLOCKED Q |
| R1-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L882) | BLOCKED Q |
| R2-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L886) | BLOCKED Q |
| R2-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L887) | BLOCKED Q |
| R2-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L888) | BLOCKED Q |
| R2-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L889) | BLOCKED Q |
| R2-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L890) | BLOCKED Q |
| R2-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L891) | BLOCKED Q |
| R2-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L892) | BLOCKED Q |
| R2-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L893) | BLOCKED Q |
| R2-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L894) | BLOCKED Q |
| R2-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L895) | BLOCKED Q |
| R2-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L896) | BLOCKED Q |
| R2-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L897) | BLOCKED Q |
| R2-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L898) | BLOCKED Q |
| R2-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L899) | BLOCKED Q |
| R2-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L900) | BLOCKED Q |
| R2-016 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L901) | BLOCKED Q |
| R2-017 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L902) | BLOCKED Q |
| R2-018 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L903) | BLOCKED Q |
| R2-019 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L904) | BLOCKED Q |
| R2-020 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L905) | BLOCKED Q |
| R2-021 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L906) | BLOCKED Q |
| R2-022 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L907) | BLOCKED Q |
| R2-023 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L908) | BLOCKED Q |
| R2-024 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L909) | BLOCKED Q |
| R2-025 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L910) | BLOCKED Q |
| R2-026 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L911) | BLOCKED Q |
| R2-027 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L912) | BLOCKED Q |
| R2-028 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L913) | BLOCKED Q |
| R2-029 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L914) | BLOCKED Q |
| R2-030 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L915) | BLOCKED Q |
| R2-031 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L916) | BLOCKED Q |
| R2-032 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L917) | BLOCKED Q |
| R2-033 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L918) | BLOCKED Q |
| R2-034 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L919) | BLOCKED Q |
| R2-035 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L920) | BLOCKED Q |
| R2-036 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L921) | BLOCKED Q |
| R2-037 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L922) | BLOCKED Q |
| R2-038 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L923) | BLOCKED Q |
| R2-039 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L924) | BLOCKED Q |
| R2-040 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L925) | BLOCKED Q |
| R2-041 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L926) | BLOCKED Q |
| R2-042 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L927) | BLOCKED Q |
| R2-043 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L928) | BLOCKED Q |
| R2-044 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L929) | BLOCKED Q |
| R2-045 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L930) | BLOCKED Q |
| R2-046 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L931) | BLOCKED Q |
| R2-047 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L932) | BLOCKED Q |
| R2-048 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L933) | BLOCKED Q |
| R2-049 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L934) | BLOCKED Q |
| R2-050 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L935) | BLOCKED Q |
| R2-051 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L936) | BLOCKED Q |
| R2-052 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L937) | BLOCKED Q |
| R2-053 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L938) | BLOCKED Q |
| R2-054 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L939) | BLOCKED Q |
| R2-055 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L940) | BLOCKED Q |
| R2-056 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L941) | BLOCKED Q |
| R2-057 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L942) | BLOCKED Q |
| R2-058 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L943) | BLOCKED Q |
| R2-059 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L944) | BLOCKED Q |
| R2-060 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L945) | BLOCKED Q |
| R2-061 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L946) | BLOCKED Q |
| R2-062 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L947) | BLOCKED Q |
| R2-063 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L948) | BLOCKED Q |
| R2-064 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L949) | BLOCKED Q |
| R2-065 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L950) | BLOCKED Q |
| R2-066 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L951) | BLOCKED Q |
| R2-067 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L952) | BLOCKED Q |
| R2-068 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L953) | BLOCKED Q |
| R2-069 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L954) | BLOCKED Q |
| R2-070 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L955) | BLOCKED Q |
| R2-071 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L956) | BLOCKED Q |
| R2-072 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L957) | BLOCKED Q |
| R2-073 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L958) | BLOCKED Q |
| R2-074 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L959) | BLOCKED Q |
| R2-075 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L960) | BLOCKED Q |
| R2-076 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L961) | BLOCKED Q |
| R2-077 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L962) | BLOCKED Q |
| R2-078 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L963) | BLOCKED Q |
| R2-079 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L964) | BLOCKED Q |
| R2-080 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L965) | BLOCKED Q |
| R2-081 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L966) | BLOCKED Q |
| R2-082 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L967) | BLOCKED Q |
| R2-083 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L968) | BLOCKED Q |
| R2-084 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L969) | BLOCKED Q |
| R2-085 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L970) | BLOCKED Q |
| R2-086 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L971) | BLOCKED Q |
| R2-087 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L972) | BLOCKED Q |
| R2-088 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L973) | BLOCKED Q |
| R2-089 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L974) | BLOCKED Q |
| R2-090 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L975) | BLOCKED Q |
| R2-091 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L976) | BLOCKED Q |
| R2-092 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L977) | BLOCKED Q |
| R2-093 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L978) | BLOCKED Q |
| R2-094 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L979) | BLOCKED Q |
| R2-095 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L980) | BLOCKED Q |
| R2-096 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L981) | BLOCKED Q |
| R2-097 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L982) | BLOCKED Q |
| R2-098 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L983) | BLOCKED Q |
| R2-099 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L984) | BLOCKED Q |
| R2-100 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L985) | BLOCKED Q |
| R2-101 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L986) | BLOCKED Q |
| R2-102 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L987) | BLOCKED Q |
| R2-103 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L988) | BLOCKED Q |
| R2-104 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L989) | BLOCKED Q |
| R2-105 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L990) | BLOCKED Q |
| R2-106 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L991) | BLOCKED Q |
| R2-107 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L992) | BLOCKED Q |
| R2-108 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L993) | BLOCKED Q |
| R2-109 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L994) | BLOCKED Q |
| R2-110 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L995) | BLOCKED Q |
| R2-111 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L996) | BLOCKED Q |
| R3-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1000) | BLOCKED Q |
| R3-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1001) | BLOCKED Q |
| R3-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1002) | BLOCKED Q |
| R3-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1003) | BLOCKED Q |
| R3-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1004) | BLOCKED Q |
| R3-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1005) | BLOCKED Q |
| R3-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1006) | BLOCKED Q |
| R3-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1007) | BLOCKED Q |
| R3-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1008) | BLOCKED Q |
| R3-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1009) | BLOCKED Q |
| R3-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1010) | BLOCKED Q |
| R3-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1011) | BLOCKED Q |
| R3-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1012) | BLOCKED Q |
| R3-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1013) | BLOCKED Q |
| R3-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1014) | BLOCKED Q |
| R3-016 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1015) | BLOCKED Q |
| R3-017 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1016) | BLOCKED Q |
| R3-018 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1017) | BLOCKED Q |
| R3-019 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1018) | BLOCKED Q |
| R3-020 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1019) | BLOCKED Q |
| R3-021 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1020) | BLOCKED Q |
| R3-022 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1021) | BLOCKED Q |
| R3-023 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1022) | BLOCKED Q |
| R3-024 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1023) | BLOCKED Q |
| R3-025 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1024) | BLOCKED Q |
| R3-026 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1025) | BLOCKED Q |
| R3-027 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1026) | BLOCKED Q |
| R3-028 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1027) | BLOCKED Q |
| R3-029 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1028) | BLOCKED Q |
| R3-030 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1029) | BLOCKED Q |
| R3-031 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1030) | BLOCKED Q |
| R3-032 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1031) | BLOCKED Q |
| R3-033 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1032) | BLOCKED Q |
| R3-034 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1033) | BLOCKED Q |
| R3-035 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1034) | BLOCKED Q |
| R3-036 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1035) | BLOCKED Q |
| R3-037 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1036) | BLOCKED Q |
| R3-038 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1037) | BLOCKED Q |
| R3-039 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1038) | BLOCKED Q |
| R3-040 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1039) | BLOCKED Q |
| R3-041 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1040) | BLOCKED Q |
| R3-042 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1041) | BLOCKED Q |
| R3-043 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1042) | BLOCKED Q |
| R3-044 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1043) | BLOCKED Q |
| R3-045 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1044) | BLOCKED Q |
| R3-046 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1045) | BLOCKED Q |
| R3-047 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1046) | BLOCKED Q |
| R3-048 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1047) | BLOCKED Q |
| R3-049 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1048) | BLOCKED Q |
| R3-050 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1049) | BLOCKED Q |
| R3-051 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1050) | BLOCKED Q |
| R3-052 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1051) | BLOCKED Q |
| R3-053 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1052) | BLOCKED Q |
| R3-054 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1053) | BLOCKED Q |
| R3-055 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1054) | BLOCKED Q |
| R3-056 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1055) | BLOCKED Q |
| R3-057 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1056) | BLOCKED Q |
| R3-058 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1057) | BLOCKED Q |
| R3-059 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1058) | BLOCKED Q |
| R3-060 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1059) | BLOCKED Q |
| R3-061 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1060) | BLOCKED Q |
| R3-062 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1061) | BLOCKED Q |
| R3-063 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1062) | BLOCKED Q |
| R3-064 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1063) | BLOCKED Q |
| R3-065 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1064) | BLOCKED Q |
| R3-066 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1065) | BLOCKED Q |
| R3-067 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1066) | BLOCKED Q |
| R3-068 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1067) | BLOCKED Q |
| R3-069 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1068) | BLOCKED Q |
| R3-070 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1069) | BLOCKED Q |
| R3-071 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1070) | BLOCKED Q |
| R3-072 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1071) | BLOCKED Q |
| R3-073 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1072) | BLOCKED Q |
| R3-074 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1073) | BLOCKED Q |
| R3-075 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1074) | BLOCKED Q |
| R3-076 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1075) | BLOCKED Q |
| R3-077 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1076) | BLOCKED Q |
| R3-078 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1077) | BLOCKED Q |
| R3-079 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1078) | BLOCKED Q |
| R3-080 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1079) | BLOCKED Q |
| R3-081 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1080) | BLOCKED Q |
| R3-082 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1081) | BLOCKED Q |
| R3-083 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1082) | BLOCKED Q |
| R3-084 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1083) | BLOCKED Q |
| R4-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1087) | BLOCKED Q |
| R4-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1088) | BLOCKED Q |
| R4-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1089) | BLOCKED Q |
| R4-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1090) | BLOCKED Q |
| R4-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1091) | BLOCKED Q |
| R4-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1092) | BLOCKED Q |
| R4-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1093) | BLOCKED Q |
| R4-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1094) | BLOCKED Q |
| R4-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1095) | BLOCKED Q |
| R4-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1096) | BLOCKED Q |
| R4-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1097) | BLOCKED Q |
| R4-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1098) | BLOCKED Q |
| R4-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1099) | BLOCKED Q |
| R4-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1100) | BLOCKED Q |
| R4-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1101) | BLOCKED Q |
| R4-016 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1102) | BLOCKED Q |
| R4-017 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1103) | BLOCKED Q |
| R4-018 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1104) | BLOCKED Q |
| R4-019 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1105) | BLOCKED Q |
| R4-020 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1106) | BLOCKED Q |
| R4-021 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1107) | BLOCKED Q |
| R4-022 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1108) | BLOCKED Q |
| R4-023 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1109) | BLOCKED Q |
| R4-024 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1110) | BLOCKED Q |
| R4-025 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1111) | BLOCKED Q |
| R4-026 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1112) | BLOCKED Q |
| R4-027 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1113) | BLOCKED Q |
| R4-028 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1114) | BLOCKED Q |
| R4-029 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1115) | BLOCKED Q |
| R4-030 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1116) | BLOCKED Q |
| R4-031 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1117) | BLOCKED Q |
| R4-032 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1118) | BLOCKED Q |
| R4-033 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1119) | BLOCKED Q |
| R4-034 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1120) | BLOCKED Q |
| R4-035 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1121) | BLOCKED Q |
| R4-036 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1122) | BLOCKED Q |
| R4-037 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1123) | BLOCKED Q |
| R4-038 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1124) | BLOCKED Q |
| R4-039 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1125) | BLOCKED Q |
| R4-040 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1126) | BLOCKED Q |
| R4-041 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1127) | BLOCKED Q |
| R4-042 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1128) | BLOCKED Q |
| R4-043 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1129) | BLOCKED Q |
| R4-044 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1130) | BLOCKED Q |
| R4-045 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1131) | BLOCKED Q |
| R4-046 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1132) | BLOCKED Q |
| R4-047 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1133) | BLOCKED Q |
| R4-048 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1134) | BLOCKED Q |
| R4-049 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1135) | BLOCKED Q |
| R4-050 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1136) | BLOCKED Q |
| R4-051 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1137) | BLOCKED Q |
| R4-052 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1138) | BLOCKED Q |
| R4-053 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1139) | BLOCKED Q |
| R4-054 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1140) | BLOCKED Q |
| R4-055 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1141) | BLOCKED Q |
| R4-056 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1142) | BLOCKED Q |
| R4-057 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1143) | BLOCKED Q |
| R4-058 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1144) | BLOCKED Q |
| R4-059 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1145) | BLOCKED Q |
| R4-060 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1146) | BLOCKED Q |
| R4-061 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1147) | BLOCKED Q |
| R4-062 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1148) | BLOCKED Q |
| R4-063 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1149) | BLOCKED Q |
| R4-064 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1150) | BLOCKED Q |
| R4-065 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1151) | BLOCKED Q |
| R4-066 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1152) | BLOCKED Q |
| R4-067 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1153) | BLOCKED Q |
| R4-068 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1154) | BLOCKED Q |
| R4-069 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1155) | BLOCKED Q |
| R4-070 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1156) | BLOCKED Q |
| R4-071 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1157) | BLOCKED Q |
| R4-072 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1158) | BLOCKED Q |
| R4-073 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1159) | BLOCKED Q |
| R4-074 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1160) | BLOCKED Q |
| R4-075 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1161) | BLOCKED Q |
| R4-076 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1162) | BLOCKED Q |
| R4-077 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1163) | BLOCKED Q |
| R4-078 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1164) | BLOCKED Q |
| R4-079 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1165) | BLOCKED Q |
| R4-080 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1166) | BLOCKED Q |
| R4-081 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1167) | BLOCKED Q |
| R4-082 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1168) | BLOCKED Q |
| R4-083 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1169) | BLOCKED Q |
| R4-084 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1170) | BLOCKED Q |
| R4-085 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1171) | BLOCKED Q |
| R4-086 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1172) | BLOCKED Q |
| R4-087 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1173) | BLOCKED Q |
| R4-088 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1174) | BLOCKED Q |
| R4-089 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1175) | BLOCKED Q |
| R4-090 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1176) | BLOCKED Q |
| R4-091 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1177) | BLOCKED Q |
| R4-092 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1178) | BLOCKED Q |
| R4-093 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1179) | BLOCKED Q |
| R4-094 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1180) | BLOCKED Q |
| R4-095 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1181) | BLOCKED Q |
| R4-096 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1182) | BLOCKED Q |
| R4-097 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1183) | BLOCKED Q |
| R4-098 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1184) | BLOCKED Q |
| R4-099 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1185) | BLOCKED Q |
| R4-100 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1186) | BLOCKED Q |
| R4-101 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1187) | BLOCKED Q |
| R4-102 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1188) | BLOCKED Q |
| R4-103 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1189) | BLOCKED Q |
| R4-104 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1190) | BLOCKED Q |
| R4-105 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1191) | BLOCKED Q |
| R4-106 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1192) | BLOCKED Q |
| R4-107 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1193) | BLOCKED Q |
| R4-108 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1194) | BLOCKED Q |
| R4-109 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1195) | BLOCKED Q |
| R4-110 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1196) | BLOCKED Q |
| R4-111 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1197) | BLOCKED Q |
| R4-112 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1198) | BLOCKED Q |
| R4-113 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1199) | BLOCKED Q |
| R4-114 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1200) | BLOCKED Q |
| R4-115 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1201) | BLOCKED Q |
| R4-116 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1202) | BLOCKED Q |
| R4-117 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1203) | BLOCKED Q |
| R5-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1207) | BLOCKED Q |
| R5-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1208) | BLOCKED Q |
| R5-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1209) | BLOCKED Q |
| R5-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1210) | BLOCKED Q |
| R5-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1211) | BLOCKED Q |
| R5-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1212) | BLOCKED Q |
| R5-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1213) | BLOCKED Q |
| R5-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1214) | BLOCKED Q |
| R5-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1215) | BLOCKED Q |
| R5-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1216) | BLOCKED Q |
| R5-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1217) | BLOCKED Q |
| R5-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1218) | BLOCKED Q |
| R5-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1219) | BLOCKED Q |
| R5-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1220) | BLOCKED Q |
| R5-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1221) | BLOCKED Q |
| R5-016 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1222) | BLOCKED Q |
| R5-017 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1223) | BLOCKED Q |
| R5-018 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1224) | BLOCKED Q |
| R5-019 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1225) | BLOCKED Q |
| R5-020 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1226) | BLOCKED Q |
| R5-021 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1227) | BLOCKED Q |
| R5-022 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1228) | BLOCKED Q |
| R5-023 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1229) | BLOCKED Q |
| R5-024 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1230) | BLOCKED Q |
| R5-025 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1231) | BLOCKED Q |
| R5-026 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1232) | BLOCKED Q |
| R5-027 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1233) | BLOCKED Q |
| R5-028 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1234) | BLOCKED Q |
| R5-029 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1235) | BLOCKED Q |
| R5-030 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1236) | BLOCKED Q |
| R5-031 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1237) | BLOCKED Q |
| R5-032 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1238) | BLOCKED Q |
| R5-033 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1239) | BLOCKED Q |
| R5-034 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1240) | BLOCKED Q |
| R5-035 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1241) | BLOCKED Q |
| R5-036 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1242) | BLOCKED Q |
| R5-037 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1243) | BLOCKED Q |
| R5-038 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1244) | BLOCKED Q |
| R5-039 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1245) | BLOCKED Q |
| R5-040 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1246) | BLOCKED Q |
| R5-041 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1247) | BLOCKED Q |
| R6-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1251) | BLOCKED Q |
| R6-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1252) | BLOCKED Q |
| R6-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1253) | BLOCKED Q |
| R6-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1254) | BLOCKED Q |
| R6-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1255) | BLOCKED Q |
| R6-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1256) | BLOCKED Q |
| R6-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1257) | BLOCKED Q |
| R6-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1258) | BLOCKED Q |
| R6-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1259) | BLOCKED Q |
| R6-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1260) | BLOCKED Q |
| R6-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1261) | BLOCKED Q |
| R6-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1262) | BLOCKED Q |
| R6-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1263) | BLOCKED Q |
| R6-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1264) | BLOCKED Q |
| R6-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1265) | BLOCKED Q |
| R6-016 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1266) | BLOCKED Q |
| R6-017 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1267) | BLOCKED Q |
| R6-018 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1268) | BLOCKED Q |
| R6-019 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1269) | BLOCKED Q |
| R6-020 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1270) | BLOCKED Q |
| R6-021 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1271) | BLOCKED Q |
| R6-022 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1272) | BLOCKED Q |
| R6-023 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1273) | BLOCKED Q |
| R6-024 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1274) | BLOCKED Q |
| R6-025 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1275) | BLOCKED Q |
| R6-026 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1276) | BLOCKED Q |
| R6-027 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1277) | BLOCKED Q |
| R6-028 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1278) | BLOCKED Q |
| R6-029 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1279) | BLOCKED Q |
| R6-030 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1280) | BLOCKED Q |
| R6-031 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1281) | BLOCKED Q |
| R6-032 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1282) | BLOCKED Q |
| R6-033 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1283) | BLOCKED Q |
| R6-034 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1284) | BLOCKED Q |
| R6-035 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1285) | BLOCKED Q |
| R6-036 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1286) | BLOCKED Q |
| R6-037 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1287) | BLOCKED Q |
| R6-038 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1288) | BLOCKED Q |
| R6-039 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1289) | BLOCKED Q |
| R6-040 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1290) | BLOCKED Q |
| R6-041 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1291) | BLOCKED Q |
| R6-042 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1292) | BLOCKED Q |
| R6-043 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1293) | BLOCKED Q |
| R6-044 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1294) | BLOCKED Q |
| R6-045 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1295) | BLOCKED Q |
| R6-046 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1296) | BLOCKED Q |
| R6-047 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1297) | BLOCKED Q |
| R6-048 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1298) | BLOCKED Q |
| R6-049 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1299) | BLOCKED Q |
| R6-050 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1300) | BLOCKED Q |
| R6-051 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1301) | BLOCKED Q |
| R6-052 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1302) | BLOCKED Q |
| R6-053 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1303) | BLOCKED Q |
| R6-054 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1304) | BLOCKED Q |
| R6-055 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1305) | BLOCKED Q |
| R6-056 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1306) | BLOCKED Q |
| R6-057 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1307) | BLOCKED Q |
| R6-058 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1308) | BLOCKED Q |
| R6-059 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1309) | BLOCKED Q |
| R6-060 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1310) | BLOCKED Q |
| R6-061 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1311) | BLOCKED Q |
| R6-062 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1312) | BLOCKED Q |
| R6-063 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1313) | BLOCKED Q |
| R6-064 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1314) | BLOCKED Q |
| R6-065 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1315) | BLOCKED Q |
| R6-066 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1316) | BLOCKED Q |
| R6-067 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1317) | BLOCKED Q |
| R6-068 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1318) | BLOCKED Q |
| R6-069 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1319) | BLOCKED Q |
| R6-070 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1320) | BLOCKED Q |
| R6-071 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1321) | BLOCKED Q |
| R6-072 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1322) | BLOCKED Q |
| R6-073 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1323) | BLOCKED Q |
| R6-074 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1324) | BLOCKED Q |
| R6-075 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1325) | BLOCKED Q |
| R6-076 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1326) | BLOCKED Q |
| R6-077 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1327) | BLOCKED Q |
| R6-078 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1328) | BLOCKED Q |
| R6-079 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1329) | BLOCKED Q |
| R6-080 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1330) | BLOCKED Q |
| R6-081 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1331) | BLOCKED Q |
| R6-082 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1332) | BLOCKED Q |
| R6-083 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1333) | BLOCKED Q |
| R6-084 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1334) | BLOCKED Q |
| R6-085 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1335) | BLOCKED Q |
| R6-086 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1336) | BLOCKED Q |
| R6-087 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1337) | BLOCKED Q |
| R6-088 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1338) | BLOCKED Q |
| R6-089 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1339) | BLOCKED Q |
| R6-090 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1340) | BLOCKED Q |
| R6-091 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1341) | BLOCKED Q |
| R6-092 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1342) | BLOCKED Q |
| R6-093 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1343) | BLOCKED Q |
| R6-094 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1344) | BLOCKED Q |
| R6-095 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1345) | BLOCKED Q |
| R6-096 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1346) | BLOCKED Q |
| R6-097 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1347) | BLOCKED Q |
| R6-098 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1348) | BLOCKED Q |
| R6-099 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1349) | BLOCKED Q |
| R6-100 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1350) | BLOCKED Q |
| R6-101 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1351) | BLOCKED Q |
| R6-102 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1352) | BLOCKED Q |
| R6-103 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1353) | BLOCKED Q |
| R6-104 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1354) | BLOCKED Q |
| R6-105 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1355) | BLOCKED Q |
| R6-106 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1356) | BLOCKED Q |
| R6-107 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1357) | BLOCKED Q |
| R6-108 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1358) | BLOCKED Q |
| R6-109 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1359) | BLOCKED Q |
| R6-110 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1360) | BLOCKED Q |
| R6-111 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1361) | BLOCKED Q |
| R6-112 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1362) | BLOCKED Q |
| R6-113 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1363) | BLOCKED Q |
| R6-114 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1364) | BLOCKED Q |
| R6-115 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1365) | BLOCKED Q |
| R6-116 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1366) | BLOCKED Q |
| R6-117 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1367) | BLOCKED Q |
| R6-118 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1368) | BLOCKED Q |
| R6-119 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1369) | BLOCKED Q |
| R6-120 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1370) | BLOCKED Q |
| R6-121 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1371) | BLOCKED Q |
| R6-122 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1372) | BLOCKED Q |
| R6-123 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1373) | BLOCKED Q |
| R6-124 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1374) | BLOCKED Q |
| R6-125 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1375) | BLOCKED Q |
| R6-126 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1376) | BLOCKED Q |
| R6-127 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1377) | BLOCKED Q |
| R6-128 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1378) | BLOCKED Q |
| R6-129 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1379) | BLOCKED Q |
| R6-130 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1380) | BLOCKED Q |
| R6-131 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1381) | BLOCKED Q |
| R6-132 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1382) | BLOCKED Q |
| R6-133 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1383) | BLOCKED Q |
| R6-134 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1384) | BLOCKED Q |
| R6-135 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1385) | BLOCKED Q |
| R6-136 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1386) | BLOCKED Q |
| R6-137 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1387) | BLOCKED Q |
| R6-138 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1388) | BLOCKED Q |
| R6-139 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1389) | BLOCKED Q |
| R6-140 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1390) | BLOCKED Q |
| R6-141 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1391) | BLOCKED Q |
| R6-142 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1392) | BLOCKED Q |
| R6-143 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1393) | BLOCKED Q |
| R6-144 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1394) | BLOCKED Q |
| R6-145 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1395) | BLOCKED Q |
| R6-146 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1396) | BLOCKED Q |
| R6-147 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1397) | BLOCKED Q |
| R6-148 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1398) | BLOCKED Q |
| R6-149 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1399) | BLOCKED Q |
| R6-150 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1400) | BLOCKED Q |
| R6-151 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1401) | BLOCKED Q |
| R7-001 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1405) | BLOCKED Q |
| R7-002 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1406) | BLOCKED Q |
| R7-003 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1407) | BLOCKED Q |
| R7-004 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1408) | BLOCKED Q |
| R7-005 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1409) | BLOCKED Q |
| R7-006 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1410) | BLOCKED Q |
| R7-007 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1411) | BLOCKED Q |
| R7-008 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1412) | BLOCKED Q |
| R7-009 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1413) | BLOCKED Q |
| R7-010 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1414) | BLOCKED Q |
| R7-011 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1415) | BLOCKED Q |
| R7-012 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1416) | BLOCKED Q |
| R7-013 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1417) | BLOCKED Q |
| R7-014 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1418) | BLOCKED Q |
| R7-015 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1419) | BLOCKED Q |
| R7-016 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1420) | BLOCKED Q |
| R7-017 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1421) | BLOCKED Q |
| R7-018 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1422) | BLOCKED Q |
| R7-019 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1423) | BLOCKED Q |
| R7-020 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1424) | BLOCKED Q |
| R7-021 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1425) | BLOCKED Q |
| R7-022 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1426) | BLOCKED Q |
| R7-023 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1427) | BLOCKED Q |
| R7-024 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1428) | BLOCKED Q |
| R7-025 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1429) | BLOCKED Q |
| R7-026 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1430) | BLOCKED Q |
| R7-027 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1431) | BLOCKED Q |
| R7-028 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1432) | BLOCKED Q |
| R7-029 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1433) | BLOCKED Q |
| R7-030 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1434) | BLOCKED Q |
| R7-031 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1435) | BLOCKED Q |
| R7-032 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1436) | BLOCKED Q |
| R7-033 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1437) | BLOCKED Q |
| R7-034 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1438) | BLOCKED Q |
| R7-035 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1439) | BLOCKED Q |
| R7-036 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1440) | BLOCKED Q |
| R7-037 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1441) | BLOCKED Q |
| R7-038 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1442) | BLOCKED Q |
| R7-039 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1443) | BLOCKED Q |
| R7-040 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1444) | BLOCKED Q |
| R7-041 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1445) | BLOCKED Q |
| R7-042 | [source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/71e8b637a5f723a33593a39f73d6cccd3573e945/plan.md#L1446) | BLOCKED Q |

## Release gates

| Gate | Disposition | Evidence gap |
| --- | --- | --- |
| R0 | FAIL | Inventory metadata exists; semantic source audit, requirement ownership and route/control census remain incomplete. |
| R1 | FAIL | Pinned parser dependencies match current upstream security advisories; independent security/tenant qualification is incomplete. |
| R2 | FAIL | Duplicate-title guard is source-reviewed; PID/start/document/task leases, races and semantic outcome verification remain incomplete. |
| R3 | FAIL | RC08 upload cancellation remains defective; current STOP/permission fault suite has not run. |
| R4 | BLOCKED | No exact-candidate interactive Windows/browser workflow campaign or adequate independent sample. |
| R5 | BLOCKED | RC01 implementation and regressions source-reviewed; cloud Python/PostgreSQL execution, expiry/restart and mixed-version tests pending. |
| R6 | BLOCKED | Exact service-worker source checks pass with mocked APIs; full real page/control/accessibility/viewport census not executed. |
| R7 | BLOCKED | Credential wiring/mock checks do not qualify deployed HIGH; real Offline artifact/inference, voice and model quota campaign unavailable. |
| R8 | BLOCKED | Support/legal/business approvals, backup restore, sustainability and independent operational proof incomplete; payments remain disabled. |
| R9 | BLOCKED | No frozen qualified candidate, staging parity/rollback proof, five consenting pilot users or launch approval. |

Commercial gate index: **0 / 10 = 0 / 100**. This is a binary evidence denominator, not the percentage of code written. Performance, cost and competitor success rates are **NOT MEASURED** for this candidate.
