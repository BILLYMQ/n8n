import { Config, Env } from '../decorators';

const MiB = 1024 * 1024;

/**
 * Hard ceilings — values above these are clamped at read time by
 * `PackageImportConfig.limits`. Exported for tests and reader call sites.
 */
export const PACKAGE_IMPORT_HARD_LIMITS = {
	maxUncompressedBytes: 300 * MiB,
	maxEntryBytes: 5 * MiB,
	maxEntries: 5_000,
	maxPathLength: 1024,
} as const;

export interface PackageImportLimits {
	maxUncompressedBytes: number;
	maxEntryBytes: number;
	maxEntries: number;
	maxPathLength: number;
}

function clamp(value: number, hardMax: number): number {
	if (!Number.isFinite(value) || value <= 0) return hardMax;
	return Math.min(value, hardMax);
}

@Config
export class PackageImportConfig {
	/** Maximum total uncompressed size in bytes for a package. Hard max: 300 MiB. */
	@Env('N8N_IMPORT_MAX_UNCOMPRESSED_BYTES')
	maxUncompressedBytes: number = PACKAGE_IMPORT_HARD_LIMITS.maxUncompressedBytes;

	/** Maximum uncompressed size in bytes for a single entry. Hard max: 5 MiB. */
	@Env('N8N_IMPORT_MAX_ENTRY_BYTES')
	maxEntryBytes: number = PACKAGE_IMPORT_HARD_LIMITS.maxEntryBytes;

	/** Maximum number of entries in a package. Hard max: 5,000. */
	@Env('N8N_IMPORT_MAX_ENTRIES')
	maxEntries: number = PACKAGE_IMPORT_HARD_LIMITS.maxEntries;

	/** Maximum length in characters of a single entry path. Hard max: 1024. */
	@Env('N8N_IMPORT_MAX_PATH_LENGTH')
	maxPathLength: number = PACKAGE_IMPORT_HARD_LIMITS.maxPathLength;

	/**
	 * Effective limits with hard ceilings applied. Call sites should consume
	 * this rather than reading the raw fields — env-supplied values above the
	 * hard max are silently capped here.
	 */
	get limits(): PackageImportLimits {
		return {
			maxUncompressedBytes: clamp(
				this.maxUncompressedBytes,
				PACKAGE_IMPORT_HARD_LIMITS.maxUncompressedBytes,
			),
			maxEntryBytes: clamp(this.maxEntryBytes, PACKAGE_IMPORT_HARD_LIMITS.maxEntryBytes),
			maxEntries: clamp(this.maxEntries, PACKAGE_IMPORT_HARD_LIMITS.maxEntries),
			maxPathLength: clamp(this.maxPathLength, PACKAGE_IMPORT_HARD_LIMITS.maxPathLength),
		};
	}
}
