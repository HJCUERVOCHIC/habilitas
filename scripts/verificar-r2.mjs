#!/usr/bin/env node
/**
 * verificar-r2.mjs — Diagnóstico de conectividad, credenciales y permisos con Cloudflare R2.
 *
 * Ubicación sugerida: scripts/verificar-r2.mjs
 *
 * Uso (Node >= 20.6):
 *   node --env-file=.env.local scripts/verificar-r2.mjs
 *
 * Si tu Node es anterior a 20.6, exporta las variables manualmente antes de correrlo.
 *
 * Requiere:
 *   npm i -D @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *
 * Variables esperadas en .env.local:
 *   R2_ENDPOINT           https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_FORCE_PATH_STYLE   (opcional: "true" para forzar path-style si hay errores de firma/host)
 */

import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REQUERIDAS = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];

const ok = (m) => console.log(`  \u2713 ${m}`);
const fail = (m) => console.log(`  \u2717 ${m}`);
const paso = (n, m) => console.log(`\n[${n}] ${m}`);

const resultados = [];
function registrar(nombre, exito, detalle) {
  resultados.push({ nombre, exito, detalle });
  exito ? ok(detalle) : fail(detalle);
}

// ---------------------------------------------------------------- 0. Entorno
paso(0, 'Variables de entorno');
const faltantes = REQUERIDAS.filter((k) => !process.env[k]);
if (faltantes.length) {
  fail(`Faltan variables: ${faltantes.join(', ')}`);
  console.log('\nAborto: no hay con qué autenticar. Revisa .env.local.\n');
  process.exit(1);
}
for (const k of REQUERIDAS) {
  const v = process.env[k];
  const muestra = k.includes('SECRET') || k.includes('ACCESS_KEY_ID')
    ? `${v.slice(0, 4)}\u2026${v.slice(-4)} (${v.length} chars)`
    : v;
  ok(`${k} = ${muestra}`);
}

const BUCKET = process.env.R2_BUCKET_NAME;
const forcePathStyle = process.env.R2_FORCE_PATH_STYLE === 'true';
ok(`forcePathStyle = ${forcePathStyle}`);

if (!/^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com\/?$/.test(process.env.R2_ENDPOINT)) {
  console.log(
    '  \u26a0 R2_ENDPOINT no luce como https://<ACCOUNT_ID>.r2.cloudflarestorage.com — ' +
      'verifica que no incluya el nombre del bucket al final.'
  );
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const KEY = `_diagnostico/verificacion-${Date.now()}.txt`;
const CONTENIDO = `Prueba de escritura Habilitas — ${new Date().toISOString()}`;

// ------------------------------------------------------- 1. Acceso al bucket
paso(1, 'Acceso al bucket (HeadBucket)');
try {
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  registrar('head', true, `Bucket "${BUCKET}" accesible.`);
} catch (e) {
  registrar('head', false, `${e.name}: ${e.message}`);
  console.log(
    '\n  Pistas:\n' +
      '   - 403 / SignatureDoesNotMatch \u2192 revisa Access Key / Secret, o prueba R2_FORCE_PATH_STYLE=true\n' +
      '   - 404 / NoSuchBucket        \u2192 el nombre del bucket no coincide\n' +
      '   - ENOTFOUND / EAI_AGAIN     \u2192 R2_ENDPOINT mal escrito o sin salida a red\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------- 2. Permiso lista
paso(2, 'Permiso de lectura del listado (ListObjectsV2)');
try {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 5 }));
  registrar('list', true, `Listado OK — ${r.KeyCount ?? 0} objeto(s) visibles en la muestra.`);
} catch (e) {
  registrar('list', false, `${e.name}: ${e.message} (token quizá sin permiso de lectura)`);
}

// ------------------------------------------------------- 3. Escritura directa
paso(3, 'Escritura directa desde el servidor (PutObject)');
try {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: CONTENIDO,
      ContentType: 'text/plain; charset=utf-8',
    })
  );
  registrar('put', true, `Objeto escrito: ${KEY}`);
} catch (e) {
  registrar('put', false, `${e.name}: ${e.message} (el token probablemente es de solo lectura)`);
}

// ---------------------------------------------------------- 4. Lectura vuelta
paso(4, 'Lectura de vuelta (GetObject)');
try {
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
  const texto = await r.Body.transformToString();
  const coincide = texto === CONTENIDO;
  registrar('get', coincide, coincide ? 'Contenido íntegro.' : 'El contenido leído NO coincide con el escrito.');
} catch (e) {
  registrar('get', false, `${e.name}: ${e.message}`);
}

// --------------------------------------------- 5. URL prefirmada de subida
paso(5, 'URL prefirmada de subida (el camino real del navegador)');
let urlFirmada = null;
try {
  urlFirmada = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${KEY}.firmado`,
      ContentType: 'text/plain',
    }),
    { expiresIn: 300 }
  );
  registrar('presign', true, `URL generada (expira en 5 min): ${urlFirmada.split('?')[0]}`);
} catch (e) {
  registrar('presign', false, `${e.name}: ${e.message}`);
}

if (urlFirmada) {
  try {
    const res = await fetch(urlFirmada, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: CONTENIDO,
    });
    registrar(
      'presign-put',
      res.ok,
      res.ok
        ? `PUT con URL prefirmada respondió ${res.status}. La firma es válida.`
        : `PUT con URL prefirmada respondió ${res.status} — ${(await res.text()).slice(0, 200)}`
    );
  } catch (e) {
    registrar('presign-put', false, `Error de red en el PUT: ${e.message}`);
  }
}

console.log(
  '\n  Nota: este PUT corre desde Node, que NO aplica CORS. Que pase aquí y falle en el\n' +
    '  navegador es el síntoma clásico de CORS mal configurado en el bucket.'
);

// -------------------------------------------------------------- 6. Limpieza
paso(6, 'Limpieza de los objetos de prueba');
for (const k of [KEY, `${KEY}.firmado`]) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: k }));
    ok(`Eliminado: ${k}`);
  } catch (e) {
    fail(`No se pudo eliminar ${k}: ${e.name}`);
  }
}

// --------------------------------------------------------------- Resumen
console.log('\n' + '\u2500'.repeat(60));
const fallidos = resultados.filter((r) => !r.exito);
if (fallidos.length === 0) {
  console.log('RESULTADO: R2 responde correctamente en credenciales, permisos y firma.');
  console.log('Siguiente frontera: CORS del bucket y estrategia de servido público.');
} else {
  console.log(`RESULTADO: ${fallidos.length} verificación(es) fallida(s):`);
  for (const f of fallidos) console.log(`  - ${f.nombre}: ${f.detalle}`);
}
console.log('\u2500'.repeat(60) + '\n');
