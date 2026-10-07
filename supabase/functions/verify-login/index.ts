import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username dan password wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, username, display_name, role, is_active, password_hash")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (error || !user) {
      return new Response(
        JSON.stringify({ error: "Username atau password salah" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!user.is_active) {
      return new Response(
        JSON.stringify({ error: "Akun tidak aktif. Hubungi pemilik." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Username atau password salah" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
