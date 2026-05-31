import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@dourak.app"

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  schema: string
  old_record?: Record<string, unknown>
  record: Record<string, unknown>
}

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const payload: WebhookPayload = await req.json()

    if (payload.table !== "tickets" || payload.type !== "UPDATE") {
      return new Response("Ignored", { status: 200 })
    }

    const oldStatus = payload.old_record?.status as string | undefined
    const newStatus = payload.record?.status as string | undefined

    if (!oldStatus || !newStatus || oldStatus === newStatus) {
      return new Response("No status change", { status: 200 })
    }

    const ticketId = payload.record.id as string
    const publicToken = payload.record.public_token as string
    const ticketNumber = payload.record.ticket_number as number

    let title = ""
    let body = ""
    let icon = ""

    if (newStatus === "active") {
      title = "حان دورك الآن"
      body = `رقم ${ticketNumber} — توجّه إلى شباك الاستقبال`
      icon = "https://dourak.app/icons/icon-192x192.png"
    } else if (newStatus === "completed") {
      title = "تمت الخدمة بنجاح"
      body = "نشكرك على زيارتك"
      icon = "https://dourak.app/icons/icon-192x192.png"
    } else {
      return new Response("No notification needed", { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: subs, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("public_token", publicToken)

    if (subError) {
      throw subError
    }

    if (!subs || subs.length === 0) {
      return new Response("No subscriptions", { status: 200 })
    }

    const results: { endpoint: string; ok: boolean; error?: string }[] = []

    for (const sub of subs as PushSubscriptionRow[]) {
      try {
        await sendWebPush(sub, { title, body, icon })
        results.push({ endpoint: sub.endpoint, ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ endpoint: sub.endpoint, ok: false, error: msg })

        if (isExpiredSubscription(msg)) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint)
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

async function sendWebPush(
  sub: PushSubscriptionRow,
  notification: { title: string; body: string; icon: string },
): Promise<void> {
  const payload = JSON.stringify(notification)

  const encrypted = await encryptPayload(
    payload,
    sub.p256dh,
    sub.auth,
  )

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "TTL": "86400",
    "Content-Encoding": "aes128gcm",
  }

  const vapidJwt = await createVapidJWT(sub.endpoint)
  headers["Authorization"] = `Bearer ${vapidJwt}`

  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers,
    body: encrypted,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Push send failed: ${response.status} ${text}`)
  }
}

function isExpiredSubscription(error: string): boolean {
  return (
    error.includes("410") ||
    error.includes("Gone") ||
    error.includes("404") ||
    error.includes("Not Found") ||
    error.includes("expired")
  )
}

async function createVapidJWT(audience: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    aud: audience,
    exp: now + 43200,
    sub: VAPID_SUBJECT,
  }

  const encoder = new TextEncoder()
  const headerB64 = urlBase64(encoder.encode(JSON.stringify(header)))
  const payloadB64 = urlBase64(encoder.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const privateKeyBytes = base64UrlToBytes(VAPID_PRIVATE_KEY)
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  )

  const signatureB64 = urlBase64(new Uint8Array(signature))

  return `${signingInput}.${signatureB64}`
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const plaintext = encoder.encode(payload)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )

  const serverPublicKey = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  const clientPublicKeyBytes = base64UrlToBytes(p256dh)
  const authSecret = base64UrlToBytes(auth)

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", publicKey: await importPublicKey(clientPublicKeyBytes) },
    serverKeyPair.privateKey,
    256,
  )

  const prk = await hkdf(
    authSecret,
    new Uint8Array(sharedSecret),
    encoder.encode("WebPush: info\x00"),
    32,
  )

  const ikm = await hkdf(
    prk,
    salt,
    encoder.encode("Content-Encoding: aes128gcm\x00"),
    32,
  )

  const contentEncryptionKey = ikm.slice(0, 16)
  const nonce = ikm.slice(16, 28)

  const iv = new Uint8Array(12)
  for (let i = 0; i < 12; i++) {
    iv[i] = nonce[i] ^ salt[i % salt.length]
  }

  const recordSize = 4096
  const paddingLen = 0
  const paddedPlaintext = new Uint8Array(plaintext.length + 1 + paddingLen + 2)
  paddedPlaintext[plaintext.length + 1] = 2
  paddedPlaintext.set(plaintext, 0)

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode("Content-Encoding: aes128gcm"), tagLength: 128 },
    await crypto.subtle.importKey("raw", contentEncryptionKey, "AES-GCM", false, ["encrypt"]),
    paddedPlaintext,
  )

  const ciphertext = new Uint8Array(cipher)

  const output = new Uint8Array(16 + serverPublicKey.byteLength + 3 + ciphertext.length)
  output.set(salt, 0)

  const keyLen = new DataView(new ArrayBuffer(4))
  keyLen.setUint32(0, serverPublicKey.byteLength, false)
  output.set(new Uint8Array(keyLen.buffer), 16)
  output.set(new Uint8Array(serverPublicKey), 20)
  output[20 + serverPublicKey.byteLength] = (recordSize >> 8) & 0xff
  output[21 + serverPublicKey.byteLength] = recordSize & 0xff
  output.set(ciphertext, 22 + serverPublicKey.byteLength)

  return output
}

async function importPublicKey(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  )
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm))

  const result = new Uint8Array(length)
  let t = new Uint8Array(0)
  for (let i = 1; result.byteOffset < length; i++) {
    const concat = new Uint8Array(t.length + info.length + 1)
    concat.set(t)
    concat.set(info, t.length)
    concat[concat.length - 1] = i

    const key2 = await crypto.subtle.importKey(
      "raw",
      prk,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )

    t = new Uint8Array(await crypto.subtle.sign("HMAC", key2, concat))
    result.set(t, result.byteOffset)
  }

  return result
}

function urlBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function base64UrlToBytes(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}
