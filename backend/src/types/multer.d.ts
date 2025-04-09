import { Request } from "express";

declare module "multer" {
	export interface File {
		fieldname: string;
		originalname: string;
		encoding: string;
		mimetype: string;
		size: number;
		destination: string;
		filename: string;
		path: string;
		buffer: Buffer;
	}

	export interface StorageEngine {
		_handleFile(
			req: Request,
			file: File,
			callback: (error?: any, info?: Partial<File>) => void
		): void;
		_removeFile(
			req: Request,
			file: File,
			callback: (error: Error) => void
		): void;
	}

	export interface DiskStorageOptions {
		destination?:
			| string
			| ((
					req: Request,
					file: File,
					callback: (error: Error | null, destination: string) => void
			  ) => void);
		filename?: (
			req: Request,
			file: File,
			callback: (error: Error | null, filename: string) => void
		) => void;
	}

	export function diskStorage(options: DiskStorageOptions): StorageEngine;
	export function memoryStorage(): StorageEngine;
	export default function multer(options?: any): any;
}

declare global {
	namespace Express {
		interface Request {
			files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
		}
	}
}
