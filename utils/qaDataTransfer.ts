import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
  readAsStringAsync,
} from "expo-file-system/legacy";
import type { JournalEntry } from "../hooks/useLocalJournalEntries";
import type { PersonalPrayer } from "../hooks/usePersonalPrayers";
import { getOrCreateDeviceId } from "./deviceIdentity";

const NOTEBOOK_STORAGE_KEY = "@daily_paths_local_journal";
const PERSONAL_PRAYERS_STORAGE_KEY = "@daily_paths_personal_prayers_v1";
const TRANSFER_VERSION = 1;

export interface QaTransferPayloadV1 {
  version: 1;
  exportedAt: string;
  deviceId: string;
  notebookEntries: JournalEntry[];
  personalPrayers: PersonalPrayer[];
}

export interface QaTransferExportResult {
  fileUri: string;
  fileName: string;
  notebookCount: number;
  prayerCount: number;
}

export interface QaTransferImportResult {
  notebookCount: number;
  prayerCount: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    typeof value.entry_type === "string" &&
    (typeof value.content === "string" || value.content === null) &&
    (isObject(value.structured_content) || value.structured_content === null) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isPersonalPrayer(value: unknown): value is PersonalPrayer {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.text === "string" &&
    typeof value.createdAt === "string"
  );
}

function parseStoredArray<T>(
  raw: string | null,
  predicate: (value: unknown) => value is T,
): T[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(predicate);
}

async function readNotebookEntries(): Promise<JournalEntry[]> {
  const raw = await AsyncStorage.getItem(NOTEBOOK_STORAGE_KEY);
  return parseStoredArray(raw, isJournalEntry);
}

async function readPersonalPrayers(): Promise<PersonalPrayer[]> {
  const raw = await AsyncStorage.getItem(PERSONAL_PRAYERS_STORAGE_KEY);
  return parseStoredArray(raw, isPersonalPrayer);
}

function getExportFileName(dateIso: string): string {
  const timestamp = dateIso.replace(/[:.]/g, "-");
  return `daily-paths-qa-transfer-${timestamp}.json`;
}

function getExportFileUri(fileName: string): string {
  const baseDir = cacheDirectory || documentDirectory || "";
  if (!baseDir) {
    throw new Error("No writable directory available for export");
  }
  return `${baseDir}${fileName}`;
}

export function validateQaTransferPayload(value: unknown): QaTransferPayloadV1 {
  if (!isObject(value)) {
    throw new Error("Payload must be a JSON object");
  }
  if (value.version !== TRANSFER_VERSION) {
    throw new Error(`Unsupported payload version: ${String(value.version)}`);
  }
  if (typeof value.exportedAt !== "string") {
    throw new Error("Payload missing exportedAt");
  }
  if (typeof value.deviceId !== "string") {
    throw new Error("Payload missing deviceId");
  }
  if (!Array.isArray(value.notebookEntries)) {
    throw new Error("Payload missing notebookEntries array");
  }
  if (!Array.isArray(value.personalPrayers)) {
    throw new Error("Payload missing personalPrayers array");
  }

  const invalidNotebook = value.notebookEntries.findIndex((entry) => !isJournalEntry(entry));
  if (invalidNotebook !== -1) {
    throw new Error(`Invalid notebook entry at index ${invalidNotebook}`);
  }

  const invalidPrayers = value.personalPrayers.findIndex((entry) => !isPersonalPrayer(entry));
  if (invalidPrayers !== -1) {
    throw new Error(`Invalid personal prayer at index ${invalidPrayers}`);
  }

  return {
    version: TRANSFER_VERSION,
    exportedAt: value.exportedAt,
    deviceId: value.deviceId,
    notebookEntries: value.notebookEntries as JournalEntry[],
    personalPrayers: value.personalPrayers as PersonalPrayer[],
  };
}

export async function createQaTransferPayload(): Promise<QaTransferPayloadV1> {
  const [notebookEntries, personalPrayers, deviceId] = await Promise.all([
    readNotebookEntries(),
    readPersonalPrayers(),
    getOrCreateDeviceId(),
  ]);

  return {
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId,
    notebookEntries,
    personalPrayers,
  };
}

export async function exportQaTransferToFile(): Promise<QaTransferExportResult> {
  const payload = await createQaTransferPayload();
  const fileName = getExportFileName(payload.exportedAt);
  const fileUri = getExportFileUri(fileName);

  await writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));

  return {
    fileUri,
    fileName,
    notebookCount: payload.notebookEntries.length,
    prayerCount: payload.personalPrayers.length,
  };
}

export async function readQaTransferFromFile(fileUri: string): Promise<QaTransferPayloadV1> {
  const raw = await readAsStringAsync(fileUri);
  const parsed = JSON.parse(raw) as unknown;
  return validateQaTransferPayload(parsed);
}

export async function importQaTransferPayload(
  payload: QaTransferPayloadV1,
): Promise<QaTransferImportResult> {
  await Promise.all([
    AsyncStorage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify(payload.notebookEntries),
    ),
    AsyncStorage.setItem(
      PERSONAL_PRAYERS_STORAGE_KEY,
      JSON.stringify(payload.personalPrayers),
    ),
  ]);

  return {
    notebookCount: payload.notebookEntries.length,
    prayerCount: payload.personalPrayers.length,
  };
}
