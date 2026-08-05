# Index Definitions — Virtual Engineer

Database: `virtual_engineer`

## Atlas Vector Search — Automated Embedding

Embeddings are generated and stored by Atlas in `__mdb_internal_search`. Application documents contain **text only**.

### `knowledge_auto_embed_index` on `knowledge_documents`

```json
{
  "name": "knowledge_auto_embed_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "autoEmbed",
        "modality": "text",
        "path": "content",
        "model": "voyage-4"
      },
      { "type": "filter", "path": "type" },
      { "type": "filter", "path": "model_families" },
      { "type": "filter", "path": "subsystem" },
      { "type": "filter", "path": "alarm_codes" }
    ]
  }
}
```

### `service_tickets_auto_embed_index` on `service_tickets`

Requires `searchable_narrative` field (populated by seed script).

```json
{
  "name": "service_tickets_auto_embed_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "autoEmbed",
        "modality": "text",
        "path": "searchable_narrative",
        "model": "voyage-4-lite"
      },
      { "type": "filter", "path": "status" },
      { "type": "filter", "path": "related_alarm_codes" },
      { "type": "filter", "path": "chiller_id" },
      { "type": "filter", "path": "type" }
    ]
  }
}
```

**Query pattern (both indexes):**

```javascript
{
  $vectorSearch: {
    index: "<index_name>",
    path: "<text_field>",
    query: { text: "natural language query here" },
    numCandidates: 100,
    limit: 10,
    filter: { /* optional */ }
  }
}
```

## Atlas Search — `service_tickets_search`

```json
{
  "name": "service_tickets_search",
  "definition": {
    "mappings": {
      "dynamic": false,
      "fields": {
        "reported_symptom": { "type": "string", "analyzer": "lucene.english" },
        "work_performed": { "type": "string", "analyzer": "lucene.english" },
        "resolution": { "type": "string", "analyzer": "lucene.english" },
        "root_cause": { "type": "string", "analyzer": "lucene.english" },
        "searchable_narrative": { "type": "string", "analyzer": "lucene.english" },
        "related_alarm_codes": { "type": "token" },
        "status": { "type": "token" },
        "type": { "type": "token" },
        "chiller_id": { "type": "token" },
        "ticket_id": { "type": "token" }
      }
    }
  }
}
```

## B-tree Indexes (created by seed script)

See `scripts/data/seed/load-sample-data.js` → `createIndexes()`.

## Provisioning Steps (Atlas UI)

1. Run `npm run seed:drop` to load all collections including `knowledge_documents`
2. Atlas → Search & Vector Search → Create Search Index on `knowledge_documents`
3. Choose JSON editor, paste `knowledge_auto_embed_index` definition, wait for initial sync
4. Create Search Index on `service_tickets` for `service_tickets_search`
5. Create Vector Search Index on `service_tickets` for `service_tickets_auto_embed_index`
6. Verify index status is **Active** before demoing semantic search tools

MCP tools fall back to regex search when vector/search indexes are unavailable (`degraded: true` in response).
