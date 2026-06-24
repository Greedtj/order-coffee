export async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.rawBody ? options.headers : { "content-type": "application/json", ...options.headers },
    body: options.rawBody || (options.body ? JSON.stringify(options.body) : undefined),
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function downloadCsv(orders) {
  const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [["ชื่อ", "ออเดอร์", "เวลา"], ...orders.map((order) => [order.customer_name, order.details, order.created_at])];
  const blob = new Blob(["\uFEFF", rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "coffee-orders.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
