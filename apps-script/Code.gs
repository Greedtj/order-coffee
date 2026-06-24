const SPREADSHEET_ID = "1aPoFqLUaZ7DLx7kjpf49ZuGFMKpsnEQULEG0PYq-CKI";

function output(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function rows(name) {
  const values = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, index) => {
    const item = { _row: index + 2 };
    headers.forEach((header, column) => item[header] = row[column] instanceof Date
      ? Utilities.formatDate(row[column], "Asia/Bangkok", header === "order_date" ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ssXXX")
      : row[column]);
    return item;
  }).filter(item => item.id);
}

function append(name, values) {
  SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name).appendRow(values);
}

function updateRow(name, row, values) {
  SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name).getRange(row, 1, 1, values.length).setValues([values]);
}

function clean(item) {
  const copy = Object.assign({}, item);
  delete copy._row;
  return copy;
}

function activeProject() {
  return rows("Projects").find(project => project.status === "open") || null;
}

function handle(action, payload) {
  if (action === "project") {
    const project = activeProject();
    if (!project) return { project: null, order: null };
    const images = rows("MenuImages").filter(image => image.project_id === project.id).map(image => ({ id: image.id, url: image.image_url }));
    const order = rows("Orders").find(item => item.project_id === project.id && item.client_token === payload.clientToken);
    return { project: Object.assign(clean(project), { images }), order: order ? { id: order.id, customer_name: order.customer_name, details: order.details } : null };
  }

  if (action === "order") {
    const project = activeProject();
    if (!project) throw { message: "ปิดรับออเดอร์แล้ว", status: 409 };
    const orders = rows("Orders");
    const existing = orders.find(item => item.project_id === project.id && item.client_token === payload.clientToken);
    const now = new Date().toISOString();
    if (existing) {
      updateRow("Orders", existing._row, [existing.id, project.id, payload.clientToken.trim(), payload.name.trim(), payload.details.trim(), existing.created_at, now]);
      return { id: existing.id, customer_name: payload.name.trim(), details: payload.details.trim() };
    }
    const id = Utilities.getUuid();
    append("Orders", [id, project.id, payload.clientToken.trim(), payload.name.trim(), payload.details.trim(), now, now]);
    return { id, customer_name: payload.name.trim(), details: payload.details.trim() };
  }

  if (action === "admin_login") {
    const cache = CacheService.getScriptCache();
    const key = `login:${payload.ip || "unknown"}`;
    const attempts = Number(cache.get(key) || 0);
    if (attempts >= 5) throw { message: "ลองใหม่อีกครั้งใน 15 นาที", status: 429 };
    if (payload.password !== PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD")) {
      cache.put(key, String(attempts + 1), 900);
      throw { message: "รหัสผ่านไม่ถูกต้อง", status: 401 };
    }
    cache.remove(key);
    return { ok: true };
  }

  if (action === "admin_state") {
    const projects = rows("Projects").reverse();
    const orders = rows("Orders");
    const images = rows("MenuImages");
    const active = projects.find(project => project.status === "open");
    return {
      projects: projects.map(project => Object.assign(clean(project), {
        order_count: orders.filter(order => order.project_id === project.id).length,
        image_count: images.filter(image => image.project_id === project.id).length,
      })),
      orders: active ? orders.filter(order => order.project_id === active.id).map(order => clean(order)) : [],
    };
  }

  if (action === "create_project") {
    const now = new Date().toISOString();
    append("Projects", [Utilities.getUuid(), payload.name.trim(), payload.date, payload.shop, "draft", now, now]);
    return { ok: true };
  }

  if (action === "set_status") {
    const projects = rows("Projects");
    const selected = projects.find(project => project.id === payload.id);
    if (!selected) throw { message: "ไม่พบโครงการ", status: 404 };
    const now = new Date().toISOString();
    if (payload.status === "open") projects.filter(project => project.status === "open").forEach(project => {
      updateRow("Projects", project._row, [project.id, project.name, project.order_date, project.shop, "closed", project.created_at, now]);
    });
    updateRow("Projects", selected._row, [selected.id, selected.name, selected.order_date, selected.shop, payload.status, selected.created_at, now]);
    return { ok: true };
  }

  if (action === "add_menu") {
    append("MenuImages", [Utilities.getUuid(), payload.projectId, payload.imageUrl, new Date().toISOString()]);
    return { ok: true };
  }

  if (action === "delete_order") {
    const order = rows("Orders").find(item => item.id === payload.id);
    if (order) SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Orders").deleteRow(order._row);
    return { ok: true };
  }

  throw { message: "ไม่พบคำสั่ง", status: 404 };
}

function doPost(event) {
  let lock;
  try {
    const request = JSON.parse(event.postData.contents || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("BACKEND_SECRET");
    if (!expected || request.backendSecret !== expected) return output({ error: "ไม่ได้รับอนุญาต", status: 401 });
    if (["order", "create_project", "set_status", "add_menu", "delete_order"].includes(request.action)) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) return output({ error: "ระบบกำลังบันทึกข้อมูล กรุณาลองใหม่", status: 503 });
    }
    return output({ data: handle(request.action, request.payload || {}), status: 200 });
  } catch (error) {
    return output({ error: error.message || "ระบบขัดข้อง", status: error.status || 500 });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function test_() {
  if (!SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Projects")) throw new Error("Projects sheet missing");
  if (!SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Orders")) throw new Error("Orders sheet missing");
  if (!SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("MenuImages")) throw new Error("MenuImages sheet missing");
}

function authorize() {
  test_();
}
