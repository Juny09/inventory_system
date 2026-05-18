DO $$
DECLARE
  v_run_key TEXT := 'vbelt_sizes_colors_20260518_v2';
BEGIN
  INSERT INTO categories (tenant_id, name, description, created_at)
  SELECT t.id, v.name, v.description, CURRENT_TIMESTAMP
  FROM tenants t
  CROSS JOIN (
    VALUES
      ('V-Belt A', 'V-Belt type A'),
      ('V-Belt B', 'V-Belt type B'),
      ('V-Belt M', 'V-Belt type M'),
      ('V-Belt XPZ', 'V-Belt type XPZ'),
      ('V-Belt SPZ', 'V-Belt type SPZ'),
      ('V-Belt XPB', 'V-Belt type XPB'),
      ('V-Belt SPB', 'V-Belt type SPB'),
      ('V-Belt XPA', 'V-Belt type XPA'),
      ('V-Belt SPA', 'V-Belt type SPA'),
      ('V-Belt Other', 'V-Belt other types')
  ) AS v(name, description)
  ON CONFLICT (tenant_id, name) DO NOTHING;

  WITH candidates AS (
    SELECT
      p.id,
      p.tenant_id,
      regexp_match(p.name, '(?i)([AB])\s*[- ]?\s*(\d{1,4})') AS m_ab,
      regexp_match(p.name, '(?i)(XPZ|SPZ|XPB|SPB|XPA|SPA|M)\s*[- ]?\s*(\d{1,4})') AS m_other,
      regexp_match(p.name, '(?i)(\d{1,4})') AS m_any
    FROM products p
    WHERE p.name ILIKE '%v-belt%'
       OR p.name ILIKE '%v belt%'
       OR p.name ILIKE '%三角带%'
  ),
  extracted AS (
    SELECT
      id,
      tenant_id,
      CASE
        WHEN m_ab IS NOT NULL THEN UPPER(m_ab[1])
        WHEN m_other IS NOT NULL THEN UPPER(m_other[1])
        ELSE NULL
      END AS belt_type,
      CASE
        WHEN m_ab IS NOT NULL THEN m_ab[2]
        WHEN m_other IS NOT NULL THEN m_other[2]
        WHEN m_any IS NOT NULL THEN m_any[1]
        ELSE NULL
      END AS size_value
    FROM candidates
  ),
  to_update AS (
    SELECT
      e.id,
      e.tenant_id,
      e.size_value,
      c.id AS new_category_id,
      ARRAY[e.size_value]::text[] AS new_sizes
    FROM extracted e
    INNER JOIN categories c
      ON c.tenant_id = e.tenant_id
     AND c.name = ('V-Belt ' || COALESCE(e.belt_type, 'Other'))
    WHERE e.size_value IS NOT NULL
  )
  INSERT INTO product_data_change_logs (tenant_id, run_key, entity_type, entity_id, before_data, after_data)
  SELECT
    p.tenant_id,
    v_run_key,
    'products',
    p.id,
    jsonb_build_object('category_id', p.category_id, 'sizes', p.sizes, 'colors', p.colors),
    jsonb_build_object('category_id', tu.new_category_id, 'sizes', tu.new_sizes, 'colors', p.colors)
  FROM to_update tu
  INNER JOIN products p ON p.id = tu.id AND p.tenant_id = tu.tenant_id
  WHERE (p.category_id IS DISTINCT FROM tu.new_category_id) OR (p.sizes IS DISTINCT FROM tu.new_sizes)
  ON CONFLICT (run_key, entity_type, entity_id) DO NOTHING;

  WITH candidates AS (
    SELECT
      p.id,
      p.tenant_id,
      regexp_match(p.name, '(?i)([AB])\s*[- ]?\s*(\d{1,4})') AS m_ab,
      regexp_match(p.name, '(?i)(XPZ|SPZ|XPB|SPB|XPA|SPA|M)\s*[- ]?\s*(\d{1,4})') AS m_other,
      regexp_match(p.name, '(?i)(\d{1,4})') AS m_any
    FROM products p
    WHERE p.name ILIKE '%v-belt%'
       OR p.name ILIKE '%v belt%'
       OR p.name ILIKE '%三角带%'
  ),
  extracted AS (
    SELECT
      id,
      tenant_id,
      CASE
        WHEN m_ab IS NOT NULL THEN UPPER(m_ab[1])
        WHEN m_other IS NOT NULL THEN UPPER(m_other[1])
        ELSE NULL
      END AS belt_type,
      CASE
        WHEN m_ab IS NOT NULL THEN m_ab[2]
        WHEN m_other IS NOT NULL THEN m_other[2]
        WHEN m_any IS NOT NULL THEN m_any[1]
        ELSE NULL
      END AS size_value
    FROM candidates
  ),
  to_update AS (
    SELECT
      e.id,
      e.tenant_id,
      e.size_value,
      c.id AS new_category_id,
      ARRAY[e.size_value]::text[] AS new_sizes
    FROM extracted e
    INNER JOIN categories c
      ON c.tenant_id = e.tenant_id
     AND c.name = ('V-Belt ' || COALESCE(e.belt_type, 'Other'))
    WHERE e.size_value IS NOT NULL
  )
  UPDATE products p
  SET category_id = tu.new_category_id,
      sizes = tu.new_sizes,
      updated_at = CURRENT_TIMESTAMP
  FROM to_update tu
  WHERE p.id = tu.id
    AND p.tenant_id = tu.tenant_id
    AND ((p.category_id IS DISTINCT FROM tu.new_category_id) OR (p.sizes IS DISTINCT FROM tu.new_sizes));

  INSERT INTO size_options (tenant_id, value)
  SELECT DISTINCT tenant_id, size_value
  FROM (
    SELECT
      p.tenant_id,
      CASE
        WHEN regexp_match(p.name, '(?i)([AB])\s*[- ]?\s*(\d{1,4})') IS NOT NULL THEN (regexp_match(p.name, '(?i)([AB])\s*[- ]?\s*(\d{1,4})'))[2]
        WHEN regexp_match(p.name, '(?i)(XPZ|SPZ|XPB|SPB|XPA|SPA|M)\s*[- ]?\s*(\d{1,4})') IS NOT NULL THEN (regexp_match(p.name, '(?i)(XPZ|SPZ|XPB|SPB|XPA|SPA|M)\s*[- ]?\s*(\d{1,4})'))[2]
        WHEN regexp_match(p.name, '(?i)(\d{1,4})') IS NOT NULL THEN (regexp_match(p.name, '(?i)(\d{1,4})'))[1]
        ELSE NULL
      END AS size_value
    FROM products p
    WHERE p.name ILIKE '%v-belt%'
       OR p.name ILIKE '%v belt%'
       OR p.name ILIKE '%三角带%'
  ) s
  WHERE s.size_value IS NOT NULL
  ON CONFLICT (tenant_id, value) DO NOTHING;
END $$;
