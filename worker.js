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

async function projectPayload(env, project) {
  if (!project) return null;
  const { results } = await env.DB.prepare("select id from menu_images where project_id = ? order by created_at, id").bind(project.id).all();
  return { ...project, images: results.map((image) => ({ id: image.id, url: `/api/menu/${image.id}` })) };
}

async function activeProject(env) {
  return env.DB.prepare("select id, name, order_date, shop, status from projects where status = 'open' limit 1").first();
}

async function publicApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/project") {
    const project = await activeProject(env);
    if (!project) return json({ project: null, order: null });
    const token = url.searchParams.get("clientToken") || "";
    const order = token ? await env.DB.prepare("select id, customer_name, details from orders where project_id = ? and client_token = ?").bind(project.id, token).first() : null;
    return json({ project: await projectPayload(env, project), order });
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    const input = await request.json().catch(() => null);
    if (!validOrder(input)) return json({ error: "กรอกชื่อและออเดอร์ให้ครบ" }, 400);
    const project = await activeProject(env);
    if (!project) return json({ error: "ปิดรับออเดอร์แล้ว" }, 409);
    const id = crypto.randomUUID();
    await env.DB.prepare(`insert into orders (id, project_id, client_token, customer_name, details)
      values (?, ?, ?, ?, ?)
      on conflict (project_id, client_token) do update set customer_name = excluded.customer_name, details = excluded.details, updated_at = datetime('now')`)
      .bind(id, project.id, input.clientToken.trim(), input.name.trim(), input.details.trim()).run();
    const order = await env.DB.prepare("select id, customer_name, details from orders where project_id = ? and client_token = ?").bind(project.id, input.clientToken.trim()).first();
    return json(order, 201);
  }

  const menuMatch = url.pathname.match(/^\/api\/menu\/([^/]+)$/);
  if (request.method === "GET" && menuMatch) {
    const image = await env.DB.prepare(`select m.object_key, m.content_type, p.status from menu_images m join projects p on p.id = m.project_id where m.id = ?`).bind(menuMatch[1]).first();
    if (!image || (image.status !== "open" && !(await admin(request, env)))) return json({ error: "ไม่พบรูปเมนู" }, 404);
    const object = await env.MENU_IMAGES.get(image.object_key);
    if (!object) return json({ error: "ไม่พบรูปเมนู" }, 404);
    return new Response(object.body, { headers: { "content-type": image.content_type, "cache-control": "public, max-age=3600" } });
  }
  return null;
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return json({ error: "ยังไม่ได้ตั้งค่ารหัสผ่านผู้ดูแล" }, 503);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const attempt = await env.DB.prepare("select attempts, reset_at from login_attempts where ip = ?").bind(ip).first();
  const now = Date.now();
  if (attempt && Number(attempt.reset_at) > now && attempt.attempts >= 5) return json({ error: "ลองใหม่อีกครั้งใน 15 นาที" }, 429);
  const input = await request.json().catch(() => ({}));
  if (input.password !== env.ADMIN_PASSWORD) {
    const resetAt = attempt && Number(attempt.reset_at) > now ? Number(attempt.reset_at) : now + 15 * 60_000;
    await env.DB.prepare(`insert into login_attempts (ip, attempts, reset_at) values (?, 1, ?)
      on conflict (ip) do update set attempts = case when reset_at > ? then attempts + 1 else 1 end, reset_at = ?`)
      .bind(ip, resetAt, now, resetAt).run();
    return json({ error: "รหัสผ่านไม่ถูกต้อง" }, 401);
  }
  await env.DB.prepare("delete from login_attempts where ip = ?").bind(ip).run();
  const expires = String(now + 7 * 24 * 60 * 60_000);
  const value = `${expires}.${await signature(expires, env.ADMIN_SESSION_SECRET)}`;
  return json({ ok: true }, 200, { "set-cookie": `coffee_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800` });
}

async function adminApi(request, env, url) {
  if (request.method === "POST" && url.pathname === "/api/admin/login") return login(request, env);
  if (!(await admin(request, env))) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  if (request.method === "POST" && url.pathname === "/api/admin/logout") return json({ ok: true }, 200, { "set-cookie": "coffee_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });

  if (request.method === "GET" && url.pathname === "/api/admin/state") {
    const projects = await env.DB.prepare(`select p.id, p.name, p.order_date, p.shop, p.status, p.created_at,
      (select count(*) from orders o where o.project_id = p.id) order_count,
      (select count(*) from menu_images m where m.project_id = p.id) image_count
      from projects p order by p.created_at desc`).all();
    const orders = await env.DB.prepare(`select o.id, o.customer_name, o.details, o.created_at
      from orders o join projects p on p.id = o.project_id where p.status = 'open' order by o.created_at`).all();
    return json({ projects: projects.results, orders: orders.results });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/projects") {
    const input = await request.json().catch(() => null);
    if (!validProject(input)) return json({ error: "ข้อมูลโครงการไม่ครบ" }, 400);
    await env.DB.prepare("insert into projects (id, name, order_date, shop) values (?, ?, ?, ?)").bind(crypto.randomUUID(), input.name.trim(), input.date, input.shop).run();
    return json({ ok: true }, 201);
  }

  const projectMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (request.method === "PATCH" && projectMatch) {
    const input = await request.json().catch(() => ({}));
    if (!new Set(["open", "closed"]).has(input.status)) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
    const exists = await env.DB.prepare("select id from projects where id = ?").bind(projectMatch[1]).first();
    if (!exists) return json({ error: "ไม่พบโครงการ" }, 404);
    if (input.status === "open") {
      await env.DB.batch([
        env.DB.prepare("update projects set status = 'closed', updated_at = datetime('now') where status = 'open'"),
        env.DB.prepare("update projects set status = 'open', updated_at = datetime('now') where id = ?").bind(projectMatch[1]),
      ]);
    } else {
      await env.DB.prepare("update projects set status = 'closed', updated_at = datetime('now') where id = ?").bind(projectMatch[1]).run();
    }
    return json({ ok: true });
  }

  const uploadMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)\/menu$/);
  if (request.method === "POST" && uploadMatch) {
    const type = request.headers.get("content-type") || "";
    const size = Number(request.headers.get("content-length") || 0);
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(type) || size > 5_000_000) return json({ error: "รองรับ JPG, PNG, WebP ขนาดไม่เกิน 5MB" }, 400);
    const project = await env.DB.prepare("select id from projects where id = ?").bind(uploadMatch[1]).first();
    if (!project) return json({ error: "ไม่พบโครงการ" }, 404);
    const body = await request.arrayBuffer();
    if (!body.byteLength || body.byteLength > 5_000_000) return json({ error: "รูปต้องมีขนาดไม่เกิน 5MB" }, 400);
    const id = crypto.randomUUID();
    const key = `${project.id}/${id}`;
    await env.MENU_IMAGES.put(key, body, { httpMetadata: { contentType: type } });
    await env.DB.prepare("insert into menu_images (id, project_id, object_key, content_type) values (?, ?, ?, ?)").bind(id, project.id, key, type).run();
    return json({ ok: true }, 201);
  }

  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (request.method === "DELETE" && orderMatch) {
    await env.DB.prepare("delete from orders where id = ?").bind(orderMatch[1]).run();
    return json({ ok: true });
  }

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
