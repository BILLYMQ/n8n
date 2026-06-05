import type { types } from 'tar';

type EntryTypeName = types.EntryTypeName;

const BLOCK_SIZE = 512;
const FILE_MODE = 0o644;
const DIRECTORY_MODE = 0o755;

const TYPEFLAG: Record<EntryTypeName, string> = {
	OldFile: '\0',
	File: '0',
	Link: '1',
	SymbolicLink: '2',
	CharacterDevice: '3',
	BlockDevice: '4',
	Directory: '5',
	FIFO: '6',
	ContiguousFile: '7',
	GlobalExtendedHeader: 'g',
	ExtendedHeader: 'x',
	SolarisACL: 'A',
	GNUDumpDir: 'D',
	Inode: 'I',
	NextFileHasLongLinkpath: 'K',
	NextFileHasLongPath: 'L',
	ContinuationFile: 'M',
	OldGnuLongPath: 'N',
	SparseFile: 'S',
	TapeVolumeHeader: 'V',
	OldExtendedHeader: 'X',
	Unsupported: '?',
};

export interface RawTarEntry {
	path: string;
	type?: EntryTypeName;
	content?: string | Buffer;
	mode?: number;
	linkpath?: string;
}

function padOctal(value: number, width: number): string {
	// width includes the trailing space/NUL byte; the octal occupies width-1.
	return value.toString(8).padStart(width - 1, '0') + '\0';
}

function writeStringField(block: Buffer, value: string, offset: number, length: number): void {
	const bytes = Buffer.from(value, 'binary');
	const copyLen = Math.min(bytes.length, length);
	bytes.copy(block, offset, 0, copyLen);
	// Remaining bytes are already zero from Buffer.alloc.
}

function writeOctalField(block: Buffer, value: number, offset: number, length: number): void {
	const octal = padOctal(value, length);
	block.write(octal, offset, length, 'binary');
}

function computeChecksum(block: Buffer): number {
	let sum = 0;
	for (let i = 0; i < BLOCK_SIZE; i++) {
		sum += i >= 148 && i < 156 ? 0x20 /* ASCII space */ : block[i];
	}
	return sum;
}

function buildHeaderBlock(entry: RawTarEntry): Buffer {
	const block = Buffer.alloc(BLOCK_SIZE);
	const type =
		entry.type ?? (entry.content !== undefined || !entry.path.endsWith('/') ? 'File' : 'Directory');
	const contentBuffer =
		entry.content === undefined
			? null
			: typeof entry.content === 'string'
				? Buffer.from(entry.content, 'utf-8')
				: entry.content;
	const contentLength = type === 'Directory' ? 0 : (contentBuffer?.length ?? 0);

	writeStringField(block, entry.path, 0, 100);
	writeOctalField(block, entry.mode ?? (type === 'Directory' ? DIRECTORY_MODE : FILE_MODE), 100, 8);
	writeOctalField(block, 0, 108, 8); // uid
	writeOctalField(block, 0, 116, 8); // gid
	writeOctalField(block, contentLength, 124, 12);
	writeOctalField(block, 0, 136, 12); // mtime — fixed
	// Checksum field placeholder (spaces) is set during computeChecksum.
	block.write('        ', 148, 8, 'binary');
	block.write(TYPEFLAG[type], 156, 1, 'binary');
	if (entry.linkpath !== undefined) {
		writeStringField(block, entry.linkpath, 157, 100);
	}
	block.write('ustar\0', 257, 6, 'binary');
	block.write('00', 263, 2, 'binary');
	// uname/gname/devmajor/devminor/prefix left zero

	const checksum = computeChecksum(block);
	const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
	block.write(checksumStr, 148, 8, 'binary');

	return block;
}

function buildDataBlocks(content: string | Buffer | undefined): Buffer {
	if (content === undefined) return Buffer.alloc(0);
	const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
	if (buffer.length === 0) return Buffer.alloc(0);
	const padded = Math.ceil(buffer.length / BLOCK_SIZE) * BLOCK_SIZE;
	const block = Buffer.alloc(padded);
	buffer.copy(block, 0);
	return block;
}

/**
 * Build a tar archive with arbitrary entries by writing tar headers
 * byte-by-byte. Unlike `TarPackageWriter` (which uses node-tar's `Pack`),
 * this helper does not sanitise paths, strip leading slashes, or refuse
 * PAX/symlink typeflags — it produces exactly the bytes the caller asks
 * for, so the security test corpus can probe the reader's defenses.
 */
export function buildRawTar(entries: RawTarEntry[]): Buffer {
	const chunks: Buffer[] = [];
	for (const entry of entries) {
		const type = entry.type ?? 'File';
		const content = type === 'Directory' ? undefined : entry.content;
		chunks.push(buildHeaderBlock({ ...entry, type, content }));
		chunks.push(buildDataBlocks(content));
	}
	// Tar archives end with two zero blocks.
	chunks.push(Buffer.alloc(BLOCK_SIZE));
	chunks.push(Buffer.alloc(BLOCK_SIZE));
	return Buffer.concat(chunks);
}
