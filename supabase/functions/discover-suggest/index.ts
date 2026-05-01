import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests before doing any auth, database, or AI work.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Give the model a bounded list of recent public memories to rank against the user's prompt.
    const { data: publicMemories } = await supabase
      .from("memories")
      .select("id, title, song_title, artist, mood, tags, date, description, image_url")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50);

    const memories = publicMemories ?? [];

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt string required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memorySummary = memories
      .map(
        (m, i) =>
          `[${i}] id="${m.id}" title="${m.title}" artist="${m.artist}" song="${m.song_title}" mood="${m.mood}" tags=[${(m.tags ?? []).join(", ")}] date=${m.date} description="${(m.description ?? "").slice(0, 150)}"`
      )
      .join("\n");

    // The model returns ids instead of full objects so the server can verify matches against real rows.
    const systemPrompt = `You are a memory matching engine for Songline, a music memory journal app.

Given a user's prompt, return ONLY a JSON object with:
- "ids": an array of memory IDs that match the user's request, ordered by relevance (most relevant first)
- "reason": a short, friendly sentence (max 20 words) explaining why these were picked

Be generous with matching — consider titles, descriptions, moods, tags, artists, songs, and themes.
For example, "sports" should match anything about playing games, volleyball, basketball, exercise, etc.
"sad" should match melancholy, heartbreak, bittersweet moods, etc.

Here are the available public memories:

${memorySummary || "No public memories available."}

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no extra text.
Example response: {"ids": ["abc-123", "def-456"], "reason": "These memories are about outdoor adventures 🏔️"}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 401) {
        return new Response(JSON.stringify({ error: "OpenAI API key is invalid or missing." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402 || status === 403) {
        return new Response(JSON.stringify({ error: "OpenAI billing or permissions are not configured." }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("OpenAI suggestion error:", status, text);
      throw new Error(`OpenAI suggestion error: ${status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Parse JSON from AI response and tolerate accidental markdown wrapping.
    let parsed: { ids: string[]; reason: string };
    try {
      const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = { ids: [], reason: "Couldn't find matching memories, try a different prompt!" };
    }

    // Filter memories to only matched ones, preserving AI's relevance order.
    const matchedMemories = parsed.ids
      .map((id: string) => memories.find((m) => m.id === id))
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        memories: matchedMemories,
        reason: parsed.reason,
        total: matchedMemories.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("discover-suggest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
