/**
 * Destinations outside the installation.
 *
 * They point at the public repository because that is what exists today - there is no
 * documentation site yet. When there is one, these constants are the only thing that
 * changes, rather than every screen that links out.
 *
 * Every use opens in a new tab: this is a self-hosted application, often on a machine
 * that is reached over a VPN, and navigating the whole window away from it to read a
 * release note loses whatever the operator was in the middle of.
 */
export const EXTERNAL = {
  /** The documentation folder in the repository. */
  docs: "https://github.com/Dpro-at/Tel-Agent/tree/main/docs",
  /** Published releases, which is where a release note belongs. */
  releases: "https://github.com/Dpro-at/Tel-Agent/releases",
} as const;
