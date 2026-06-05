import path from 'node:path';
import { jsonParse } from 'n8n-workflow';
import { Parser, type ReadEntry } from 'tar';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import type { PackageManifest } from '../../spec/manifest.schema';
import type { PackageReader } from '../package-reader';

const MANIFEST_PATH = 'manifest.json';
const ALLOWED_PATH_CHARS = /^[a-zA-Z0-9._/-]+$/;

export interface TarReaderLimits {
	maxUncompressedBytes: number;
	maxEntryBytes: number;
	maxEntries: number;
	maxPathLength: number;
}

export class TarPackageReader implements PackageReader {
	private entries: Map<string, Buffer> | null = null;

	constructor(
		private readonly buffer: Buffer,
		private readonly limits: TarReaderLimits,
	) {}

	async readManifest(): Promise<PackageManifest> {
		const entries = await this.load();
		const manifest = entries.get(MANIFEST_PATH);
		if (!manifest) {
			throw new BadRequestError('Package is missing manifest.json');
		}
		try {
			return jsonParse<PackageManifest>(manifest.toString('utf-8'));
		} catch {
			throw new BadRequestError('Package manifest is not valid JSON');
		}
	}

	async readFile(entryPath: string): Promise<Buffer> {
		const entries = await this.load();
		const content = entries.get(entryPath);
		if (!content) {
			throw new BadRequestError(`Package does not contain entry: ${entryPath}`);
		}
		return content;
	}

	async listEntries(): Promise<string[]> {
		const entries = await this.load();
		return Array.from(entries.keys());
	}

	private async load(): Promise<Map<string, Buffer>> {
		if (this.entries) return this.entries;
		this.entries = await this.parse();
		return this.entries;
	}

	private validateEntryPath(rawPath: string): string {
		const trimmed = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;

		if (trimmed.length === 0) {
			throw new BadRequestError('Package contains an entry with an empty path');
		}
		if (trimmed.length > this.limits.maxPathLength) {
			throw new BadRequestError('Package entry path exceeds the maximum allowed length');
		}
		if (trimmed.startsWith('/')) {
			throw new BadRequestError(`Package entry path "${trimmed}" must be relative`);
		}
		if (!ALLOWED_PATH_CHARS.test(trimmed)) {
			throw new BadRequestError(`Package entry path "${trimmed}" contains disallowed characters`);
		}

		const normalized = path.posix.normalize(trimmed);
		if (
			normalized === '..' ||
			normalized.startsWith('../') ||
			normalized.includes('/../') ||
			normalized.endsWith('/..')
		) {
			throw new BadRequestError(
				`Package entry path "${trimmed}" attempts to escape the package root`,
			);
		}

		return normalized;
	}

	private async parse(): Promise<Map<string, Buffer>> {
		const entries = new Map<string, Buffer>();
		let totalUncompressedBytes = 0;
		let entryCount = 0;
		let firstFileSeen = false;
		let aborted = false;
		const limits = this.limits;

		return await new Promise((resolve, reject) => {
			const parser = new Parser();

			const fail = (message: string): void => {
				if (aborted) return;
				aborted = true;
				try {
					parser.abort(new Error(message));
				} catch {
					// abort can throw if already torn down; swallow and reject below
				}
				reject(new BadRequestError(message));
			};

			parser.on('entry', (entry: ReadEntry) => {
				if (aborted) {
					entry.resume();
					return;
				}

				entryCount += 1;
				if (entryCount > limits.maxEntries) {
					fail('Package contains too many entries');
					entry.resume();
					return;
				}

				if (entry.type !== 'File' && entry.type !== 'Directory') {
					fail(`Package contains a disallowed entry type for "${entry.path}"`);
					entry.resume();
					return;
				}

				let safePath: string;
				try {
					safePath = this.validateEntryPath(entry.path);
				} catch (error) {
					fail(error instanceof BadRequestError ? error.message : 'Invalid package entry path');
					entry.resume();
					return;
				}

				if (entries.has(safePath)) {
					fail(`Package contains a duplicate entry for "${safePath}"`);
					entry.resume();
					return;
				}

				if (entry.type === 'Directory') {
					entry.resume();
					return;
				}

				if (!firstFileSeen) {
					firstFileSeen = true;
					if (safePath !== MANIFEST_PATH) {
						fail(`Package must begin with ${MANIFEST_PATH} but found "${safePath}"`);
						entry.resume();
						return;
					}
				}

				const chunks: Buffer[] = [];
				let entryBytes = 0;
				entry.on('data', (chunk: Buffer) => {
					if (aborted) return;
					entryBytes += chunk.length;
					if (entryBytes > limits.maxEntryBytes) {
						fail(
							`Package entry "${safePath}" exceeds the maximum allowed uncompressed size per entry`,
						);
						return;
					}
					totalUncompressedBytes += chunk.length;
					if (totalUncompressedBytes > limits.maxUncompressedBytes) {
						fail('Package exceeds the maximum allowed uncompressed size');
						return;
					}
					chunks.push(chunk);
				});
				entry.on('end', () => {
					if (aborted) return;
					entries.set(safePath, Buffer.concat(chunks));
				});
				entry.resume();
			});

			parser.on('error', () => {
				if (aborted) return;
				aborted = true;
				reject(new BadRequestError('Failed to read package archive'));
			});
			parser.on('end', () => {
				if (aborted) return;
				resolve(entries);
			});
			parser.end(this.buffer);
		});
	}
}
