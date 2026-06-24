import { validOrder, validProject } from "./src/validation.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});

function cookie(request, name) {
  return request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function signature(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function admin(request, env) {
  const session = cookie(request, "coffee_admin");
  if (!session || !env.ADMIN_SESSION_SECRET) return false;
  const [expires, provided] = session.split(".");
  if (!expires || Number(expires) < Date.now()) return false;
  return provided === await signature(expires, env.ADMIN_SESSION_SECRET);
}

async function backend(env, action, payload = {}) {
  if (!env.APPS_SCRIPT_URL || !env.BACKEND_SECRET) return { error: "ยังไม่ได้เชื่อม Google Sheet", status: 503 };
  const response = await fetch(env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ backendSecret: env.BACKEND_SECRET, action, payload }),
    redirect: "follow",
  });
  if (!response.ok) return { error: "เชื่อม Google Sheet ไม่สำเร็จ", status: 502 };
  return response.json();
}

function backendResponse(result, successStatus = 200) {
  return result.error ? json({ error: result.error }, result.status || 400) : json(result.data, successStatus);
}

async function publicApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/project") {
    return backendResponse(await backend(env, "project", { clientToken: url.searchParams.get("clientToken") || "" }));
  }
  if (request.method === "POST" && url.pathname === "/api/orders") {
    const input = await request.json().catch(() => null);
    if (!validOrder(input)) return json({ error: "กรอกชื่อและออเดอร์ให้ครบ" }, 400);
    return backendResponse(await backend(env, "order", input), 201);
  }
  return null;
}

async function login(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return json({ error: "ยังไม่ได้ตั้งค่าระบบผู้ดูแล" }, 503);
  const input = await request.json().catch(() => ({}));
  const result = await backend(env, "admin_login", {
    password: input.password,
    ip: request.headers.get("cf-connecting-ip") || "local",
  });
  if (result.error) return backendResponse(result);
  const expires = String(Date.now() + 7 * 24 * 60 * 60_000);
  const value = `${expires}.${await signature(expires, env.ADMIN_SESSION_SECRET)}`;
  return json({ ok: true }, 200, { "set-cookie": `coffee_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800` });
}

async function adminApi(request, env, url) {
  if (request.method === "POST" && url.pathname === "/api/admin/login") return login(request, env);
  if (!(await admin(request, env))) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  if (request.method === "POST" && url.pathname === "/api/admin/logout") return json({ ok: true }, 200, { "set-cookie": "coffee_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });
  if (request.method === "GET" && url.pathname === "/api/admin/state") return backendResponse(await backend(env, "admin_state"));

  if (request.method === "POST" && url.pathname === "/api/admin/projects") {
    const input = await request.json().catch(() => null);
    if (!validProject(input)) return json({ error: "ข้อมูลโครงการไม่ครบ" }, 400);
    return backendResponse(await backend(env, "create_project", input), 201);
  }

  const projectMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (request.method === "PATCH" && projectMatch) {
    const input = await request.json().catch(() => ({}));
    if (!new Set(["open", "closed"]).has(input.status)) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
    return backendResponse(await backend(env, "set_status", { id: projectMatch[1], status: input.status }));
  }

  const menuMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)\/menu$/);
  if (request.method === "POST" && menuMatch) {
    const input = await request.json().catch(() => ({}));
    if (!/^https:\/\/\S+$/i.test(input.imageUrl || "")) return json({ error: "กรุณาใช้ลิงก์รูปแบบ HTTPS" }, 400);
    return backendResponse(await backend(env, "add_menu", { projectId: menuMatch[1], imageUrl: input.imageUrl }));
  }

  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (request.method === "DELETE" && orderMatch) return backendResponse(await backend(env, "delete_order", { id: orderMatch[1] }));
  return json({ error: "ไม่พบข้อมูล" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/admin")) return await adminApi(request, env, url);
      if (url.pathname.startsWith("/api/")) return (await publicApi(request, env, url)) || json({ error: "ไม่พบข้อมูล" }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: "ระบบขัดข้อง กรุณาลองใหม่" }, 500);
    }
  },
};
