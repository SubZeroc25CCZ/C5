// CI runs bare `tsc --noEmit` without the generated next-env.d.ts (it is
// gitignored), so Next's image-module declarations — which make static
// imports like `import img from "…/x.png"` type as StaticImageData — must
// be referenced from a committed file. This is the same reference
// next-env.d.ts carries; locally it is a harmless duplicate.
/// <reference types="next/image-types/global" />
