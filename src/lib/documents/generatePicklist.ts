import { supabase } from "@/lib/supabase";

export interface PicklistOptions {
  includeOrgLogo?: boolean;
  includeBarcodes?: boolean;
}

interface PicklistLine {
  barcode: string;
  product_name: string;
  quantity: number;
  area_name: string;
  strain_name: string | null;
  batch_external_id: string | null;
}

interface PicklistData {
  order_number: string;
  account_name: string | null;
  account_license: string | null;
  generated_at: string;
  org_name: string | null;
  delivery_notes: string | null;
  lines_by_area: Record<string, PicklistLine[]>;
}

/**
 * Query the order's allocations and group them by source area so pickers can
 * walk one area at a time. Returns print-ready HTML.
 */
export async function generatePicklist(orderId: string, _opts: PicklistOptions = {}): Promise<string> {
  const { data: order, error: oErr } = await supabase
    .from("grow_orders")
    .select("id, order_number, org_id, account_id, status, delivery_notes")
    .eq("id", orderId)
    .single();
  if (oErr || !order) throw new Error(oErr?.message ?? "Order not found");

  const [{ data: account }, { data: org }, { data: items }] = await Promise.all([
    order.account_id
      ? supabase.from("grow_accounts").select("company_name, license_number").eq("id", order.account_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("organizations").select("name").eq("id", order.org_id).single(),
    supabase.from("grow_order_items").select("id, product_id, quantity").eq("order_id", orderId),
  ]);

  const itemIds = ((items ?? []) as any[]).map((i) => i.id);
  const productIds = ((items ?? []) as any[]).map((i) => i.product_id).filter(Boolean);
  const { data: allocs } = itemIds.length > 0
    ? await supabase.from("grow_order_allocations").select("*").in("order_item_id", itemIds)
    : { data: [] };

  const batchIds = Array.from(new Set(((allocs ?? []) as any[]).map((a) => a.batch_id).filter(Boolean)));
  const [{ data: batches }, { data: products }] = await Promise.all([
    batchIds.length > 0
      ? supabase.from("grow_batches").select("id, barcode, external_id, strain_id, area_id").in("id", batchIds)
      : Promise.resolve({ data: [] }),
    productIds.length > 0
      ? supabase.from("grow_products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] }),
  ]);

  const areaIds = Array.from(new Set(((batches ?? []) as any[]).map((b) => b.area_id).filter(Boolean)));
  const strainIds = Array.from(new Set(((batches ?? []) as any[]).map((b) => b.strain_id).filter(Boolean)));
  const [{ data: areas }, { data: strains }] = await Promise.all([
    areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
    strainIds.length > 0 ? supabase.from("grow_strains").select("id, name").in("id", strainIds) : Promise.resolve({ data: [] }),
  ]);

  const batchById = new Map<string, any>(((batches ?? []) as any[]).map((b) => [b.id, b]));
  const itemById = new Map<string, any>(((items ?? []) as any[]).map((i) => [i.id, i]));
  const productById = new Map<string, any>(((products ?? []) as any[]).map((p) => [p.id, p]));
  const areaById = new Map<string, any>(((areas ?? []) as any[]).map((a) => [a.id, a]));
  const strainById = new Map<string, any>(((strains ?? []) as any[]).map((s) => [s.id, s]));

  const linesByArea: Record<string, PicklistLine[]> = {};
  ((allocs ?? []) as any[]).forEach((a) => {
    const batch = batchById.get(a.batch_id);
    const item = itemById.get(a.order_item_id);
    if (!batch) return;
    const product = item ? productById.get(item.product_id) : null;
    const area = batch.area_id ? areaById.get(batch.area_id) : null;
    const strain = batch.strain_id ? strainById.get(batch.strain_id) : null;
    const areaName = area?.name ?? "Unassigned";
    const line: PicklistLine = {
      barcode: batch.barcode,
      product_name: product?.name ?? "—",
      quantity: Number(a.quantity ?? 0),
      area_name: areaName,
      strain_name: strain?.name ?? null,
      batch_external_id: batch.external_id ?? null,
    };
    (linesByArea[areaName] = linesByArea[areaName] ?? []).push(line);
  });

  const data: PicklistData = {
    order_number: (order as any).order_number,
    account_name: (account as any)?.company_name ?? null,
    account_license: (account as any)?.license_number ?? null,
    generated_at: new Date().toISOString(),
    org_name: (org as any)?.name ?? null,
    delivery_notes: (order as any).delivery_notes ?? null,
    lines_by_area: linesByArea,
  };

  return renderPicklistHTML(data);
}

function renderPicklistHTML(data: PicklistData): string {
  const areas = Object.keys(data.lines_by_area).sort();
  const totalLines = areas.reduce((s, a) => s + data.lines_by_area[a].length, 0);
  const totalQty = areas.reduce(
    (s, a) => s + data.lines_by_area[a].reduce((ss, l) => ss + l.quantity, 0), 0);

  const esc = (s: string | null | undefined) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const date = new Date(data.generated_at);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Picklist — ${esc(data.order_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; color: #111; }
    h1 { margin: 0 0 4px 0; font-size: 22px; }
    h2 { font-size: 14px; margin: 20px 0 8px 0; border-bottom: 2px solid #111; padding-bottom: 4px; }
    .hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .meta { font-size: 11px; color: #555; line-height: 1.6; }
    .meta strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { padding: 6px 8px; text-align: left; font-size: 11px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
    .num { text-align: right; font-family: "SF Mono", Monaco, monospace; }
    .chk { width: 24px; text-align: center; }
    .chk input { transform: scale(1.3); }
    .bc { font-family: "SF Mono", Monaco, monospace; font-size: 10px; color: #333; }
    .totals { margin-top: 24px; padding-top: 12px; border-top: 2px solid #111; display: flex; justify-content: space-between; font-size: 11px; }
    .sig { margin-top: 32px; display: flex; gap: 32px; }
    .sig > div { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-size: 10px; color: #555; }
    @media print { body { padding: 12px; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>Picklist</h1>
      <div class="meta"><strong>Order:</strong> ${esc(data.order_number)}</div>
    </div>
    <div class="meta" style="text-align: right;">
      ${data.org_name ? `<div><strong>${esc(data.org_name)}</strong></div>` : ""}
      <div><strong>For:</strong> ${esc(data.account_name ?? "—")}</div>
      ${data.account_license ? `<div><strong>License:</strong> ${esc(data.account_license)}</div>` : ""}
      <div><strong>Generated:</strong> ${date.toLocaleString()}</div>
    </div>
  </div>
  ${data.delivery_notes ? `<div style="margin:0 0 16px 0;padding:10px 12px;border-left:3px solid #f59e0b;background:#fef3c7;border-radius:4px;"><strong style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#92400e;">Delivery notes</strong><div style="font-size:12px;margin-top:2px;white-space:pre-wrap;">${esc(data.delivery_notes)}</div></div>` : ""}

  ${areas.length === 0 ? `<p style="color:#999;font-style:italic;">No allocations on this order yet.</p>` : areas.map((area) => {
    const lines = data.lines_by_area[area];
    return `<h2>${esc(area)} <span style="font-weight:400;color:#666;font-size:11px;">· ${lines.length} line${lines.length === 1 ? "" : "s"}</span></h2>
    <table>
      <thead>
        <tr>
          <th class="chk">✓</th>
          <th>Barcode</th>
          <th>Product</th>
          <th>Strain</th>
          <th class="num">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((l) => `<tr>
          <td class="chk"><input type="checkbox" /></td>
          <td class="bc">${esc(l.barcode)}</td>
          <td>${esc(l.product_name)}</td>
          <td>${esc(l.strain_name ?? "—")}</td>
          <td class="num"><strong>${l.quantity}</strong></td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  }).join("")}

  <div class="totals">
    <div><strong>Areas:</strong> ${areas.length}</div>
    <div><strong>Total lines:</strong> ${totalLines}</div>
    <div><strong>Total units:</strong> ${totalQty}</div>
  </div>

  <div class="sig">
    <div>Picked by (name &amp; signature)</div>
    <div>Verified by (name &amp; signature)</div>
    <div>Date / time complete</div>
  </div>
</body>
</html>`;
}

/** Open picklist HTML in a new window for printing. */
export function openPicklistWindow(html: string): void {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { console.warn("Popup blocked"); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the window a moment to layout, then trigger print
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignore */ } }, 350);
}
