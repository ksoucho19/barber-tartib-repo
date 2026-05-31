import crypto from "crypto"
import fs from "fs"
import path from "path"

const curve = crypto.createECDH("prime256v1")
curve.generateKeys()

const publicKey = curve.getPublicKey()
const privateKey = curve.getPrivateKey()

function toBase64Url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

const pubB64 = toBase64Url(publicKey)
const privB64 = toBase64Url(privateKey)

const envPath = path.resolve(process.cwd(), ".env.local")
const envContent = `
# VAPID keys for Web Push (generated ${new Date().toISOString()})
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pubB64}
VAPID_PRIVATE_KEY=${privB64}
VAPID_SUBJECT=mailto:admin@dourak.app
`

console.log("Generated VAPID keys:")
console.log("")
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${pubB64}"`)
console.log(`VAPID_PRIVATE_KEY="${privB64}"`)
console.log('VAPID_SUBJECT="mailto:admin@dourak.app"')
console.log("")
console.log(`Appending to ${envPath}...`)

fs.appendFileSync(envPath, envContent, "utf-8")
console.log(`Done. Keys appended to ${envPath}`)
