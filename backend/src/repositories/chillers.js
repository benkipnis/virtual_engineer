import { getDb } from "../db/client.js";

export async function getChillerById(chillerId) {
  const db = await getDb();
  return db.collection("chillers").findOne({ chiller_id: chillerId });
}

export async function getSiteById(siteId) {
  const db = await getDb();
  return db.collection("sites").findOne({ site_id: siteId });
}

export async function getSiteContextForChiller(chillerId) {
  const chiller = await getChillerById(chillerId);
  if (!chiller) return { chiller: null, site: null };
  const site = await getSiteById(chiller.site_id);
  return { chiller, site };
}
