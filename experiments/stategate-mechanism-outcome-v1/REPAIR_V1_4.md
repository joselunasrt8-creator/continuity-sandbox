# v1.4 repair candidate — REPAIRED_PENDING_REVIEW

Consumer: issue #43 and PR #44; not an execution issue. No scenario execution or outcome collection is authorized.

Prior v1.3: head c1283d2da4490cf2e5bcc13ec1db2f5505a1d8a7; payload 1648256215c4c6736c73a1b667a1d96859c6fc5b; tree 35b7e181799e70d4a9c06e32806817d3c85fe918; freeze SHA-256 baea9126f93994450337dd7f7d935c95de6ba375fb465b5de97df42e76c82152. Original manifest bytes copied to history/v1.3-freeze-manifest.json; full original files remain available at the immutable ancestor. Earlier failed payloads remain ancestors and in the successor manifest. No historical evidence or review bodies are rewritten.

| Finding | Candidate repair | Verification |
|---|---|---|
| F1 delay anchor | Classifier references timestamps.evaluation_ready_at exactly | Anchor drift rejected by validator; unchanged 45-second gate |
| F2 completeness | Retained bytes, SHA-256, frozen field adapters, arm source restrictions, independent key and inventory/bracket verification | Original arbitrary-artifact 100% probe, wrong path/arm, absent/tampered bytes, disagreement and relabelled common collector rejected |
| F3 replay claims | Fixed command/runtime/input/two output record; locally reproduce bytes and derive status | Original unsupported PASS rejected; retained A replay accepted and forged output rejected |
| F4 permissions | B/C actions: read; no repository-token write permission | Permission regression |
| F5 raw event | Equal non-gating native-event archive in all arms with exact bytes | Byte-sensitive E06 positive/negative; base manifest common workflow |
| F6 required checks | Exact A/B/C contexts and latest terminal matching run/check | Extra/missing checks and newer failure negatives |
| F7 mergeability | Affirmative clean/open/non-draft state required | dirty/behind/blocked/unknown/null negatives |
| F8 reviewers | Archive authorized reviewer identity and stable repository permissions; replay counts that reviewer only | read/triage/unknown/different-reviewer negatives |
| F9 timing/billing | Fully paginated exact-attempt jobs plus available/unavailable timing responses | Collector acquisition coverage, job overlap/billing rules |
| F10 operator ledger | Registered monotonic half-open interval union; no rounding/double count | Overlap positive; reversed/duplicate/forged scalar negatives |
| F11 reconstruction | Five exact questions/answers, prospective key, all-or-nothing correctness; missing/unknown incorrect | Complete positive; partial/late-key negatives |

Run node regression-tests.mjs and node validate-protocol.mjs from this directory. These are synthetic protocol-construction checks, not experimental episodes. Numeric gates, arms, cohort, randomized order, fixture mutations, ground truth and StateGate release remain unchanged. New event archival is equal common instrumentation, not an arm intervention.

The candidate cannot claim PROTOCOL_FROZEN until a fresh independent exact-head review is clean. Offline retained-byte checks cannot authenticate entirely forged source archives, clock claims, or reviewer custody; independent provenance review is required. Runtime and artifact retention preflight remain execution prerequisites. A billing endpoint that is unavailable remains missing, not fabricated economics.
