// supabase/functions/visitor-track/index.ts
// Deploy with: supabase functions deploy visitor-track
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const allowedEvents = ["page_view", "gps_shared"];
    const allowedDevices = ["mobile", "tablet", "desktop"];
    if (!allowedEvents.includes(body.event_type) || !allowedDevices.includes(body.device_type)) {
      return new Response(JSON.stringify({ error: "Invalid event" }), { status: 400, headers: cors });
    }

    const cleanText = (v: unknown, max: number, fallback = "") =>
      typeof v === "string" ? v.slice(0, max) : fallback;
    const lat = body.gps_latitude == null ? null : Number(body.gps_latitude);
    const lon = body.gps_longitude == null ? null : Number(body.gps_longitude);
    const hasGps = body.event_type === "gps_shared";
    if (hasGps && (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat! < -90 || lat! > 90 || lon! < -180 || lon! > 180)) {
      return new Response(JSON.stringify({ error: "Invalid GPS coordinates" }), { status: 400, headers: cors });
    }

    // No raw IP address is stored. IP-derived city/region is intentionally left null
    // until the site owner chooses and discloses an approved geolocation provider.
    const row = {
      event_type: body.event_type,
      device_type: body.device_type,
      platform: cleanText(body.platform, 80, "Unknown"),
      browser: cleanText(body.browser, 40, "Other"),
      language: cleanText(body.language, 20),
      screen: cleanText(body.screen, 20),
      page_path: cleanText(body.page_path, 300),
      referrer_host: cleanText(body.referrer_host, 150) || null,
      gps_latitude: hasGps ? lat : null,
      gps_longitude: hasGps ? lon : null,
      gps_accuracy_m: hasGps && Number.isFinite(Number(body.gps_accuracy_m))
        ? Math.min(100000, Math.max(0, Math.round(Number(body.gps_accuracy_m)))) : null
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable");
      return new Response(JSON.stringify({ error: "Server configuration is incomplete" }), {
        status: 500, headers: cors
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.from("visitor_events").insert(row);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
  } catch (e) {
    console.error("visitor-track error", e);
    const message = e instanceof Error ? e.message : "Unknown server error";
    return new Response(JSON.stringify({ error: message.slice(0, 240) }), {
      status: 500, headers: cors
    });
  }
});
