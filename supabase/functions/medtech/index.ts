// 의료기술직 매일 모의고사 API (생물·공중보건·의료관계법규). 교사 기능은 레벨 테스트와 같은 교사 키로 보호.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const PAGE = "medtech";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const kst = (plusDays = 0) => new Date(Date.now() + 9 * 3600e3 + plusDays * 86400e3).toISOString().slice(0, 10);
const todayKST = () => kst(0);

let keyHash: string | null = null;
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function isTeacher(key: unknown) {
  if (typeof key !== "string" || !key || key.length > 200) return false;
  if (!keyHash) {
    const { data } = await sb.from("config").select("value").eq("key", "teacher_key_sha256").maybeSingle();
    keyHash = data?.value ?? null;
  }
  if (!keyHash) return false;
  const h = await sha256(key);
  let diff = h.length ^ keyHash.length;
  for (let i = 0; i < Math.min(h.length, keyHash.length); i++) diff |= h.charCodeAt(i) ^ keyHash.charCodeAt(i);
  return diff === 0;
}

type Q = { s: string; unit: string; q: string; passage?: string; fig?: string; options: string[]; answer: number; exp: string };
type SetRow = { date: string; questions: Q[]; released: boolean };
type SubRow = { rid: string; page: string; name: string; set_id: string; answers: number[]; created_at: string };

const strip = (q: Q) => ({ s: q.s, unit: q.unit, q: q.q, passage: q.passage, fig: q.fig, options: q.options });
const subOut = (r: SubRow) => ({ rid: r.rid, name: r.name, setId: r.set_id, answers: r.answers, at: new Date(r.created_at).getTime() });

async function getSet(date: string): Promise<SetRow | null> {
  const { data, error } = await sb.from("medtech_sets").select("date,questions,released").eq("date", date).maybeSingle();
  if (error) throw error;
  return data as SetRow | null;
}

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const newRid = () => {
  const b = new Uint8Array(10);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
};
async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const t = await req.text();
    if (t.length > 20000) return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const p = url.searchParams;
  const route = url.pathname.split("/").filter(Boolean).pop();
  try {
    // 오늘(한국 시간) 이하 최신 세트 (정답·해설 제외)
    if (req.method === "GET" && route === "set") {
      const { data, error } = await sb.from("medtech_sets").select("date,questions,released")
        .lte("date", todayKST()).order("date", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      const set = data as SetRow | null;
      if (!set) return json({ error: "not found" }, 404);
      return json({ date: set.date, released: set.released, questions: set.questions.map(strip) });
    }

    if (req.method === "POST" && route === "submit") {
      const b = await body(req);
      if (!b) return json({ error: "bad json" }, 400);
      const name = typeof b.name === "string" ? b.name.trim() : "";
      const setId = typeof b.setId === "string" ? b.setId : "";
      const answers = b.answers;
      if (!name || name.length > 20) return json({ error: "bad name" }, 400);
      if (!DATE_RE.test(setId)) return json({ error: "bad setId" }, 400);
      const set = await getSet(setId);
      if (!set) return json({ error: "no set" }, 400);
      // -2 = '잘 몰라요'
      if (!Array.isArray(answers) || answers.length !== set.questions.length ||
          !answers.every((a, i) => Number.isInteger(a) && (a === -2 || (a >= 0 && a < set.questions[i].options.length))))
        return json({ error: "answers mismatch" }, 400);
      for (let i = 0; i < 3; i++) {
        const rid = newRid();
        const { error } = await sb.from("submissions").insert({ rid, page: PAGE, name, set_id: setId, grade: null, answers, texts: null });
        if (!error) return json({ rid });
        if (error.code !== "23505") throw error;
      }
      return json({ error: "save failed" }, 500);
    }

    // 결과: 선생님이 OK하기 전에는 잠금
    if (req.method === "GET" && route === "result") {
      const rid = p.get("rid") ?? "";
      if (!/^[a-z0-9]{10}$/.test(rid)) return json({ error: "bad rid" }, 400);
      const { data, error } = await sb.from("submissions").select("*").eq("rid", rid).eq("page", PAGE).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "not found" }, 404);
      const d = subOut(data as SubRow);
      const set = await getSet(d.setId);
      if (!set) return json({ error: "not found" }, 404);
      if (!set.released) return json({ rid: d.rid, name: d.name, setId: d.setId, at: d.at, locked: true });
      return json({ ...d, locked: false, questions: set.questions });
    }

    if (req.method === "GET" && route === "teacher") {
      if (!(await isTeacher(p.get("key")))) return json({ error: "forbidden" }, 403);
      const { data: drows, error: de } = await sb.from("medtech_sets").select("date").lte("date", kst(14))
        .order("date", { ascending: false }).limit(240);
      if (de) throw de;
      const dates = (drows ?? []).map((r: { date: string }) => r.date);
      const want = p.get("date");
      const today = todayKST();
      const date = want && DATE_RE.test(want) ? want : (dates.find((d) => d <= today) ?? dates[0]);
      if (!date) return json({ dates: [], date: null, set: null, subs: [] });
      const set = await getSet(date);
      const { data: subs, error: ue } = await sb.from("submissions").select("*").eq("page", PAGE).eq("set_id", date)
        .order("created_at", { ascending: false }).limit(100);
      if (ue) throw ue;
      return json({ dates, date, set, subs: (subs as SubRow[]).map(subOut) });
    }

    if (req.method === "POST" && route === "release") {
      const b = await body(req);
      if (!b) return json({ error: "bad json" }, 400);
      if (!(await isTeacher(b.key))) return json({ error: "forbidden" }, 403);
      const date = String(b.date ?? "");
      if (!DATE_RE.test(date)) return json({ error: "bad args" }, 400);
      const { data, error } = await sb.from("medtech_sets").update({ released: b.released === true }).eq("date", date).select("date");
      if (error) throw error;
      return data && data.length ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
