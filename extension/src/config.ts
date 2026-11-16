// Set at build time by extension/build.mjs.
declare const __REGIBEE_URL__: string;
declare const __EXTENSION_VERSION__: string;
declare const __EXTENSION_VERSION_NAME__: string;

/** The Regibee site the extension talks to: https://www.regibee.com, or localhost in dev builds. */
export const REGIBEE_URL: string = __REGIBEE_URL__;
export const VERSION: string = __EXTENSION_VERSION__;
/** The version with the pull request it came from, such as "0.2.0.57 (#212)". */
export const VERSION_NAME: string = __EXTENSION_VERSION_NAME__;
