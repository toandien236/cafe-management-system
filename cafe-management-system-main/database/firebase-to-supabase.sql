-- Incremental migration for projects that already ran supabase-schema.sql.
-- This replaces app-data policies and revokes public access to customer/operational rows.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS source_firebase_id TEXT;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source_firebase_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_source_firebase_id_uidx
  ON public.reservations (source_firebase_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_source_firebase_id_uidx
  ON public.orders (source_firebase_id);

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('reservations', 'orders', 'inventory', 'stock_imports', 'stock_exports', 'menu_items')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$$;

REVOKE ALL ON public.reservations FROM PUBLIC, anon;
REVOKE ALL ON public.orders FROM PUBLIC, anon;
REVOKE ALL ON public.inventory FROM PUBLIC, anon;
REVOKE ALL ON public.stock_imports FROM PUBLIC, anon;
REVOKE ALL ON public.stock_exports FROM PUBLIC, anon;
REVOKE ALL ON public.menu_items FROM PUBLIC, anon;
GRANT INSERT ON public.reservations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_exports TO authenticated;
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservations_public_insert
  ON public.reservations FOR INSERT TO anon
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 255
    AND length(trim(email)) BETWEEN 3 AND 255
    AND guests BETWEEN 1 AND 50
    AND status = 'pending'
    AND email_status = 'Pending'
  );
CREATE POLICY reservations_admin_access
  ON public.reservations FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY orders_admin_access
  ON public.orders FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY inventory_admin_access
  ON public.inventory FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY stock_imports_admin_access
  ON public.stock_imports FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY stock_exports_admin_access
  ON public.stock_exports FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY menu_items_public_read
  ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY menu_items_admin_write
  ON public.menu_items FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.create_order(
  p_order_id TEXT,
  p_table_number TEXT,
  p_items JSONB,
  p_note TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result_order public.orders;
  supplied_item_count INTEGER;
  matched_item_count INTEGER;
BEGIN
  IF p_order_id IS NULL OR p_order_id !~ '^ORD-[A-Za-z0-9-]{1,45}$' THEN
    RAISE EXCEPTION 'Invalid order reference';
  END IF;
  IF p_table_number IS NULL OR p_table_number !~ '^[0-9]{2}$'
    OR p_table_number::INTEGER NOT BETWEEN 1 AND 99 THEN
    RAISE EXCEPTION 'Invalid table number';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid order items';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid order items';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS line(item)
    WHERE jsonb_typeof(line.item -> 'id') IS DISTINCT FROM 'string'
       OR COALESCE(line.item ->> 'quantity', '') !~ '^[1-9][0-9]?$'
  ) THEN
    RAISE EXCEPTION 'Invalid order item quantity or id';
  END IF;

  SELECT count(*) INTO supplied_item_count
  FROM (
    SELECT item ->> 'id' AS item_id
    FROM jsonb_array_elements(p_items) AS line(item)
    GROUP BY item ->> 'id'
  ) requested;

  WITH requested AS (
    SELECT item ->> 'id' AS item_id, sum((item ->> 'quantity')::INTEGER) AS quantity
    FROM jsonb_array_elements(p_items) AS line(item)
    GROUP BY item ->> 'id'
  )
  SELECT count(*) INTO matched_item_count FROM requested WHERE quantity > 99;
  IF matched_item_count > 0 THEN
    RAISE EXCEPTION 'Requested item quantity exceeds the limit';
  END IF;

  WITH requested AS (
    SELECT item ->> 'id' AS item_id, sum((item ->> 'quantity')::INTEGER) AS quantity
    FROM jsonb_array_elements(p_items) AS line(item)
    GROUP BY item ->> 'id'
  )
  SELECT
    count(*),
    jsonb_agg(jsonb_build_object(
      'id', menu.id,
      'name', menu.name,
      'price', menu.price,
      'quantity', requested.quantity
    ) ORDER BY menu.category, menu.name),
    sum(menu.price * requested.quantity)
  INTO matched_item_count, result_order.items, result_order.total
  FROM requested
  JOIN public.menu_items AS menu
    ON menu.id = requested.item_id AND menu.is_available = true;

  IF matched_item_count <> supplied_item_count THEN
    RAISE EXCEPTION 'One or more menu items are unavailable';
  END IF;

  INSERT INTO public.orders (
    order_id, table_number, items, total, note, status, payment_status
  ) VALUES (
    p_order_id, p_table_number, result_order.items, result_order.total,
    left(COALESCE(p_note, ''), 1000), 'new', 'unpaid'
  )
  RETURNING * INTO result_order;

  RETURN result_order.order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END;
$$;
