// Verification agent: cross-checks insights against the live Magento catalog
// and flags low-confidence claims. Goal: prevent the content generator from
// recommending products that don't exist or making up specs.
//
// For v1: marks verified=true if confidence >= 0.6 AND every product_mention
// appears in the Magento catalog (best-effort search). Otherwise verified=false.
//
import axios from "axios";
import { getDb } from "../db/index.js";
import { enqueue } from "../queue/index.js";
import { config } from "../config.js";

async function magentoHasProduct(name: string): Promise<boolean> {
  if (!config.magento.token || !config.magento.baseUrl) return false;
  try {
    const url = `${config.magento.baseUrl}/products?searchCriteria[filter_groups][0][filters][0][field]=name` +
      `&searchCriteria[filter_groups][0][filters][0][value]=%25${encodeURIComponent(name)}%25` +
      `&searchCriteria[filter_groups][0][filters][0][condition_type]=like` +
      `&searchCriteria[pageSize]=1`;
    const r = await axios.get(url, {
      timeout: 8000,
      headers: { Authorization: `Bearer ${config.magento.token}` },
    });
    return Array.isArray(r.data?.items) && r.data.items.length > 0;
  } catch {
    return false;
  }
}

export async function runVerification(input: { video_id: string }): Promise<void> {
  const db = getDb();
  const r = await db.query<{ confidence: number; product_mentions: string[] }>(
    `SELECT confidence, product_mentions FROM insights WHERE video_id = $1`,
    [input.video_id],
  );
  if (!r.rowCount) throw new Error(`No insights for ${input.video_id}`);
  const { confidence, product_mentions } = r.rows[0];

  // Verify each product mention against Magento (in parallel)
  const checks = await Promise.all(product_mentions.slice(0, 10).map(magentoHasProduct));
  const allFound = checks.length === 0 ? true : checks.every(Boolean);
  const verified = confidence >= 0.6 && allFound;

  await db.query(`UPDATE insights SET verified = $1 WHERE video_id = $2`, [verified, input.video_id]);
  if (verified) {
    await enqueue("content-generation", { video_id: input.video_id });
  } else {
    console.log(`[verification] video ${input.video_id} not verified (confidence=${confidence}, allFound=${allFound})`);
  }
}
