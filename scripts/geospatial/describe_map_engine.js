import { APP_PROFILE } from "../../src/features/fab/profile.js";
import { getMapEngineManifest } from "../../src/features/map/engine/index.js";

const manifest = getMapEngineManifest(APP_PROFILE);

console.log(JSON.stringify(manifest, null, 2));
