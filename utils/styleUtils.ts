import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export const styleMerge = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

export const validImageRegex = /^o\.(?!26258\.jpg)\d+\.jpg$/;
