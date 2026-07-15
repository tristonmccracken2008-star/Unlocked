import { opportunities as seedOpportunities, type Opportunity } from "@/data/opportunities";

export type ManagedOpportunity = { opportunity: Opportunity; archived: boolean; deleted: boolean; createdAt: string; updatedAt: string };
export type ContentAuditLog = { id: string; opportunityId: string; timestamp: string; adminEmail: string; action: "create" | "update" | "archive" | "restore" | "delete"; fieldsChanged: string[] };

type MemoryValue = string | Set<string> | string[];
const memory = new Map<string, MemoryValue>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const indexKey = "unlocked:content:opportunity-ids";
const auditKey = "unlocked:content:audit-log";
const recordKey = (id: string) => `unlocked:content:opportunity:${id}`;

async function command<T>(args: string[]): Promise<T | null> {
  if (!kvUrl || !kvToken) {
    const [op,key,...rest] = args;
    if (op === "GET") return (memory.get(key) as T) ?? null;
    if (op === "SET") { memory.set(key,rest[0]); return "OK" as T; }
    if (op === "SADD") { const set=memory.get(key) as Set<string>??new Set<string>();set.add(rest[0]);memory.set(key,set);return 1 as T; }
    if (op === "SMEMBERS") return [...(memory.get(key) as Set<string>??new Set<string>())] as T;
    if (op === "LPUSH") { const list=memory.get(key) as string[]??[];list.unshift(rest[0]);memory.set(key,list);return list.length as T; }
    if (op === "LTRIM") { const list=memory.get(key) as string[]??[];memory.set(key,list.slice(Number(rest[0]),Number(rest[1])+1));return "OK" as T; }
    if (op === "LRANGE") return (memory.get(key) as string[]??[]).slice(Number(rest[0]),Number(rest[1])+1) as T;
    throw new Error(`Unsupported content store operation: ${op}`);
  }
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),2800);try{const response=await fetch(kvUrl,{method:"POST",headers:{Authorization:`Bearer ${kvToken}`,"Content-Type":"application/json"},body:JSON.stringify(args),cache:"no-store",signal:controller.signal});
  if(!response.ok)throw new Error(`Content database failed: ${response.status}`);
  return ((await response.json()) as {result:T|null}).result;}catch(error){if(error instanceof Error&&error.name==="AbortError")throw new Error("Content database timed out.");throw error}finally{clearTimeout(timeout)}
}

function requireWritableStore(){if((!kvUrl||!kvToken)&&process.env.NODE_ENV==="production")throw new Error("Production content storage is not configured. Set KV_REST_API_URL/KV_REST_API_TOKEN or the Upstash equivalents.")}
const parse=<T>(value:T|string|null)=>{if(typeof value!=="string")return value as T|null;try{return JSON.parse(value) as T}catch{return null}};

export async function listManagedRecords() {
  const ids=await command<string[]>(["SMEMBERS",indexKey])??[];
  const stored=(await Promise.all(ids.map(async(id)=>parse<ManagedOpportunity>(await command<string>(["GET",recordKey(id)]))))).filter((item):item is ManagedOpportunity=>Boolean(item));
  const byId=new Map(stored.map((item)=>[item.opportunity.id,item]));
  for(const item of seedOpportunities)if(!byId.has(item.id))byId.set(item.id,{opportunity:item,archived:false,deleted:false,createdAt:item.date_added,updatedAt:item.last_verified});
  return [...byId.values()].sort((a,b)=>a.opportunity.title.localeCompare(b.opportunity.title));
}

export async function listPublishedOpportunities(){return (await listManagedRecords()).filter((item)=>!item.archived&&!item.deleted).map((item)=>item.opportunity)}
export async function listPublishedOpportunitiesByIds(ids: readonly string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const records = await Promise.all(uniqueIds.map(async (id) => {
    const managed = parse<ManagedOpportunity>(await command<string>(["GET", recordKey(id)]));
    if (managed) return managed.archived || managed.deleted ? undefined : managed.opportunity;
    return seedOpportunities.find((opportunity) => opportunity.id === id);
  }));
  return records.filter((opportunity): opportunity is Opportunity => Boolean(opportunity));
}
export async function getManagedOpportunity(id:string){return (await listManagedRecords()).find((item)=>item.opportunity.id===id&&!item.archived&&!item.deleted)?.opportunity}
export async function getManagedRecord(id:string){return (await listManagedRecords()).find((item)=>item.opportunity.id===id)}

async function logEdit(entry:Omit<ContentAuditLog,"id"|"timestamp">){const log:ContentAuditLog={...entry,id:crypto.randomUUID(),timestamp:new Date().toISOString()};await command(["LPUSH",auditKey,JSON.stringify(log)]);await command(["LTRIM",auditKey,"0","499"])}
export async function saveManagedOpportunity(opportunity:Opportunity,adminEmail:string,fieldsChanged:string[],isCreate=false){requireWritableStore();const current=await getManagedRecord(opportunity.id);const now=new Date().toISOString();const record:ManagedOpportunity={opportunity,archived:current?.archived??false,deleted:false,createdAt:current?.createdAt??now,updatedAt:now};await command(["SET",recordKey(opportunity.id),JSON.stringify(record)]);await command(["SADD",indexKey,opportunity.id]);await logEdit({opportunityId:opportunity.id,adminEmail,action:isCreate?"create":"update",fieldsChanged});return record}
export async function setManagedArchive(id:string,archived:boolean,adminEmail:string){requireWritableStore();const current=await getManagedRecord(id);if(!current)throw new Error("Opportunity not found");const record={...current,archived,deleted:false,updatedAt:new Date().toISOString()};await command(["SET",recordKey(id),JSON.stringify(record)]);await command(["SADD",indexKey,id]);await logEdit({opportunityId:id,adminEmail,action:archived?"archive":"restore",fieldsChanged:["archived"]});return record}
export async function deleteManagedOpportunity(id:string,adminEmail:string){requireWritableStore();const current=await getManagedRecord(id);if(!current)throw new Error("Opportunity not found");const record={...current,archived:true,deleted:true,updatedAt:new Date().toISOString()};await command(["SET",recordKey(id),JSON.stringify(record)]);await command(["SADD",indexKey,id]);await logEdit({opportunityId:id,adminEmail,action:"delete",fieldsChanged:["deleted"]})}
export async function readContentAuditLog(){const values=await command<string[]>(["LRANGE",auditKey,"0","99"])??[];return values.map((value)=>parse<ContentAuditLog>(value)).filter((item):item is ContentAuditLog=>Boolean(item))}
