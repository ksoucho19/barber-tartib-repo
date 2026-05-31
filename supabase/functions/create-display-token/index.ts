import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { SignJWT } from "https://esm.sh/jose@5.2.0"

interface ReqBody {
  slug: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    )
  }

  try {
    const { slug }: ReqBody = await req.json()

    if (!slug || typeof slug !== "string") {
      return new Response(
        JSON.stringify({ error: "slug is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle()

    if (bizError || !business) {
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      )
    }

    const jwt_secret = Deno.env.get("SUPABASE_JWT_SECRET")
    if (!jwt_secret) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const secret = new TextEncoder().encode(jwt_secret)

    const token = await new SignJWT({
      sub: business.id,
      role: "display",
      business_id: business.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret)

    return new Response(
      JSON.stringify({ token, business_name: business.name, business_id: business.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  } catch (err) {
    console.error("create-display-token error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
