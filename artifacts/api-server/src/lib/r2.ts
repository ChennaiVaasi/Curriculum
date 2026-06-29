import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

const env = {
  accountId: process.env.R2_ACCOUNT_ID?.trim(),
  accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim(),
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim(),
  bucket: process.env.R2_BUCKET?.trim(),
  catalogKey: (process.env.R2_CATALOG_KEY?.trim()) || "catalog/catalog.json",
  publicUrl: process.env.R2_PUBLIC_URL
    ? process.env.R2_PUBLIC_URL.trim().replace(/\/$/, "")
    : null,
};

let cachedClient: S3Client | null = null;

export function isR2Configured() {
  return Boolean(env.accountId && env.accessKeyId && env.secretAccessKey && env.bucket);
}

function contentDispositionFilename(filename: string) {
  const asciiFallback = filename
    .replace(/[/\\]/g, "-")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/[";]/g, "_")
    .trim() || "chapter.pdf";
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function getClient() {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured.");
  }

  if (cachedClient) {
    return cachedClient;
  }

  const config: S3ClientConfig = {
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId!,
      secretAccessKey: env.secretAccessKey!,
    },
  };

  cachedClient = new S3Client(config);
  return cachedClient;
}

export function getCatalogObjectKey() {
  return env.catalogKey;
}

export function getPublicUrl() {
  return env.publicUrl;
}

export async function uploadPdfObject(key: string, bytes: Uint8Array, filename: string) {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      ContentDisposition: contentDispositionFilename(filename),
    }),
  );
}

export async function putTextObject(key: string, body: string, contentType = "application/json") {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getTextObject(key: string) {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Missing body for object ${key}`);
  }

  return response.Body.transformToString();
}

export async function deleteObject(key: string) {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.bucket,
      Key: key,
    }),
  );
}

export async function getBinaryObject(key: string) {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Missing body for object ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();

  return {
    bytes,
    contentType: response.ContentType || "application/octet-stream",
  };
}
