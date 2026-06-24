const shops = new Set(["Café Amazon", "พันธุ์ไทย คอฟฟี่"]);

function text(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

export function validOrder(input) {
  return input && text(input.clientToken, 100) && text(input.name, 80) && text(input.details, 300);
}

export function validProject(input) {
  return input && text(input.name, 120) && /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") && shops.has(input.shop);
}
