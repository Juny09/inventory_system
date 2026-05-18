-- Prompt templates for document AI extraction
CREATE TABLE IF NOT EXISTS document_prompts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Ensure only one default per tenant
CREATE UNIQUE INDEX idx_document_prompts_one_default_per_tenant
ON document_prompts (tenant_id)
WHERE is_default = TRUE;

-- Seed a system-level default prompt for tenant_id = 1 if not exists
INSERT INTO document_prompts (tenant_id, name, content, is_default, created_by)
VALUES (
  1,
  'Default DO/Invoice Extractor',
  'You are analyzing a business document (Delivery Order or Invoice).
Extract these fields and return ONLY a JSON object with this exact structure:
{
  "documentType": "delivery_order" or "invoice" or "unknown",
  "documentNumber": "the reference number like DO-12345 or INV-67890",
  "date": "YYYY-MM-DD if found",
  "supplierName": "the company/vendor name",
  "items": [{"description": "product name", "quantity": number}]
}
Use null for missing fields. Output ONLY JSON, no markdown fences.',
  TRUE,
  NULL
)
ON CONFLICT (tenant_id, name) DO NOTHING;
