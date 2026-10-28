# r6 job net-math — deterministic Math for online lockstep (net unit; SPEC §28 determinism contract)

Online races are deterministic lockstep: every client simulates the whole race from the same inputs and must reach
bit-identical states. Browsers' `Math.sin`, `exp`, `pow`, … are allowed to differ in the last bit (V8 now uses LLVM's
libc, WebKit the system libm, Firefox an fdlibm port); measured here, a Chromium and a WebKit client of the same race
drift apart after ~29 s. The fix: our own implementations built only from + − × ÷ and `Math.sqrt` (IEEE 754 makes
those identical in every engine), installed over `Math.*` at boot.

## Build it
`src/net/detmath.ts` (split into `src/net/detmath/*.ts` files of ≤ 400 lines if it gets long, re-exported from
`detmath.ts`): exported functions `sin cos tan asin acos atan atan2 exp expm1 log log1p log2 log10 sinh cosh tanh cbrt
pow hypot` with the exact `Math.*` semantics (special values, signed zeros, NaN, ±Infinity, `hypot` with any number of
arguments) and `installDetMath(): void` that assigns them over the `Math` properties (idempotent).
- **Port, do not invent.** The reference is V8 12.4's fdlibm port, saved for you at
  `shots/ref/v8-12.4-ieee754.cc` (read it with the Read tool; also `ieee754.h` there). Port each
  function line by line: the same constants (copy the hex/decimal literals exactly), the same branches, the same order
  of operations (floating-point is not associative: `a*b+c` must stay `a*b+c`). C's word access
  (`GET_HIGH_WORD`, `EXTRACT_WORDS`, `INSERT_WORDS`, `SET_LOW_WORD`, …) becomes a shared scratch
  `Float64Array(1)` + `Int32Array`/`Uint32Array` view on the same buffer (little-endian: index 1 = high word). Integer
  arithmetic on the words uses `| 0` / `>>> 0` exactly as C's int32 / uint32. Port `__ieee754_rem_pio2` and
  `__kernel_rem_pio2` (the big argument reduction) completely — huge arguments to sin/cos/tan are tested.
  `hypot`: V8's algorithm from `shots/ref/math.tq` (`FastMathHypot` for 0–3 arguments, the Kahan-summed
  `MathHypot` loop for more): it must equal V8's native `Math.hypot` bit for bit.
- Only `+ - * /`, comparisons, the word views, `Math.sqrt` (correctly rounded everywhere), `Math.abs`,
  `Math.floor`/`ceil`/`trunc` (exact) and integer ops. Never call the native function you replace (nor
  `Math.pow` / `Math.exp` / … from inside another port), never `**`.
- Keep the fdlibm copyright notice (it asks for it) and V8's (BSD) at the top of the file.
- Fast enough: each call ≤ 2.5× the native one (no allocation per call; scratch arrays at module level).

## Files you own
`src/net/detmath.ts`, `src/net/detmath/` (your split files).

## Acceptance (the runner runs these; read `tools/r6/detmath.mjs` first)
- `node tools/r4/tsc-own.mjs src/net/` → TSC-OWN OK
- `node tools/r6/detmath.mjs` → r6-detmath OK (within 1 ulp of native on 40 000+ inputs per function, hypot equal to
  native, WebKit returns exactly Chromium's outputs, ≤ 2.5× native time, the installer works)
