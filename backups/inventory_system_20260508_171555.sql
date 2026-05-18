--
-- PostgreSQL database dump
--

\restrict OJEJR3Uc8GL8rH9qvzfUtgJYfsz5OlEp09CYWaVt2UQ5gwCe6WpAooh43JJPMve

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    user_email character varying(150),
    user_role character varying(20),
    action character varying(80) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id character varying(120),
    method character varying(10) NOT NULL,
    path text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bank_statements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_statements (
    id integer NOT NULL,
    uploaded_by integer NOT NULL,
    statement_month date NOT NULL,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.bank_statements OWNER TO postgres;

--
-- Name: bank_statements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_statements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_statements_id_seq OWNER TO postgres;

--
-- Name: bank_statements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_statements_id_seq OWNED BY public.bank_statements.id;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    country character varying(100),
    made_in character varying(100)
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brands_id_seq OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    parent_id integer
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: delivery_order_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_order_attachments (
    id integer NOT NULL,
    do_id integer NOT NULL,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.delivery_order_attachments OWNER TO postgres;

--
-- Name: delivery_order_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_order_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_order_attachments_id_seq OWNER TO postgres;

--
-- Name: delivery_order_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_order_attachments_id_seq OWNED BY public.delivery_order_attachments.id;


--
-- Name: delivery_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_order_items (
    id integer NOT NULL,
    do_id integer NOT NULL,
    product_id integer,
    item_code character varying(120),
    description text,
    serial_no character varying(200),
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.delivery_order_items OWNER TO postgres;

--
-- Name: delivery_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_order_items_id_seq OWNER TO postgres;

--
-- Name: delivery_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_order_items_id_seq OWNED BY public.delivery_order_items.id;


--
-- Name: delivery_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_orders (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    supplier_id integer NOT NULL,
    do_no character varying(80) NOT NULL,
    do_date date NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    warehouse_id integer,
    posted_to_inventory boolean DEFAULT false NOT NULL
);


ALTER TABLE public.delivery_orders OWNER TO postgres;

--
-- Name: delivery_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_orders_id_seq OWNER TO postgres;

--
-- Name: delivery_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_orders_id_seq OWNED BY public.delivery_orders.id;


--
-- Name: document_prompts; Type: TABLE; Schema: public; Owner: inventory_user
--

CREATE TABLE public.document_prompts (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(120) NOT NULL,
    content text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_prompts OWNER TO inventory_user;

--
-- Name: document_prompts_id_seq; Type: SEQUENCE; Schema: public; Owner: inventory_user
--

CREATE SEQUENCE public.document_prompts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_prompts_id_seq OWNER TO inventory_user;

--
-- Name: document_prompts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: inventory_user
--

ALTER SEQUENCE public.document_prompts_id_seq OWNED BY public.document_prompts.id;


--
-- Name: low_stock_alert_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.low_stock_alert_states (
    id integer NOT NULL,
    product_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    assigned_to integer,
    notes text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT low_stock_alert_states_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'READ'::character varying, 'IGNORED'::character varying])::text[])))
);


ALTER TABLE public.low_stock_alert_states OWNER TO postgres;

--
-- Name: low_stock_alert_states_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.low_stock_alert_states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.low_stock_alert_states_id_seq OWNER TO postgres;

--
-- Name: low_stock_alert_states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.low_stock_alert_states_id_seq OWNED BY public.low_stock_alert_states.id;


--
-- Name: marketplace_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_connections (
    id integer NOT NULL,
    channel character varying(30) NOT NULL,
    shop_name character varying(120),
    api_base_url text,
    access_token text,
    refresh_token text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_connections OWNER TO postgres;

--
-- Name: marketplace_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_connections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_connections_id_seq OWNER TO postgres;

--
-- Name: marketplace_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_connections_id_seq OWNED BY public.marketplace_connections.id;


--
-- Name: marketplace_error_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_error_logs (
    id integer NOT NULL,
    channel character varying(30) NOT NULL,
    operation character varying(60) NOT NULL,
    error_code character varying(60) NOT NULL,
    message text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id character varying(60),
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_error_logs OWNER TO postgres;

--
-- Name: marketplace_error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_error_logs_id_seq OWNER TO postgres;

--
-- Name: marketplace_error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_error_logs_id_seq OWNED BY public.marketplace_error_logs.id;


--
-- Name: marketplace_inventory_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_inventory_snapshots (
    id integer NOT NULL,
    channel character varying(30) NOT NULL,
    external_sku character varying(120) NOT NULL,
    product_id integer,
    warehouse_id integer,
    on_hand integer DEFAULT 0 NOT NULL,
    allocated_quantity integer DEFAULT 0 NOT NULL,
    available_quantity integer DEFAULT 0 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    synced_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_inventory_snapshots OWNER TO postgres;

--
-- Name: marketplace_inventory_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_inventory_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_inventory_snapshots_id_seq OWNER TO postgres;

--
-- Name: marketplace_inventory_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_inventory_snapshots_id_seq OWNED BY public.marketplace_inventory_snapshots.id;


--
-- Name: marketplace_oauth_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_oauth_states (
    id integer NOT NULL,
    channel character varying(30) NOT NULL,
    state_token character varying(120) NOT NULL,
    redirect_uri text,
    expires_at timestamp without time zone NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_oauth_states OWNER TO postgres;

--
-- Name: marketplace_oauth_states_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_oauth_states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_oauth_states_id_seq OWNER TO postgres;

--
-- Name: marketplace_oauth_states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_oauth_states_id_seq OWNED BY public.marketplace_oauth_states.id;


--
-- Name: marketplace_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_order_items (
    id integer NOT NULL,
    marketplace_order_id integer NOT NULL,
    external_item_id character varying(120),
    external_sku character varying(120),
    product_id integer,
    quantity integer DEFAULT 0 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_order_items OWNER TO postgres;

--
-- Name: marketplace_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_order_items_id_seq OWNER TO postgres;

--
-- Name: marketplace_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_order_items_id_seq OWNED BY public.marketplace_order_items.id;


--
-- Name: marketplace_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_orders (
    id integer NOT NULL,
    channel character varying(30) NOT NULL,
    external_order_id character varying(120) NOT NULL,
    order_status character varying(40) DEFAULT 'PENDING'::character varying NOT NULL,
    buyer_name character varying(120),
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    order_created_at timestamp without time zone,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    synced_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_orders OWNER TO postgres;

--
-- Name: marketplace_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_orders_id_seq OWNER TO postgres;

--
-- Name: marketplace_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_orders_id_seq OWNED BY public.marketplace_orders.id;


--
-- Name: marketplace_sync_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_sync_logs (
    id integer NOT NULL,
    channel character varying(30) NOT NULL,
    sync_type character varying(30) DEFAULT 'inventory'::character varying NOT NULL,
    status character varying(20) DEFAULT 'SUCCESS'::character varying NOT NULL,
    records_count integer DEFAULT 0 NOT NULL,
    raw_response jsonb DEFAULT '{}'::jsonb NOT NULL,
    synced_by integer,
    synced_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.marketplace_sync_logs OWNER TO postgres;

--
-- Name: marketplace_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.marketplace_sync_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_sync_logs_id_seq OWNER TO postgres;

--
-- Name: marketplace_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.marketplace_sync_logs_id_seq OWNED BY public.marketplace_sync_logs.id;


--
-- Name: product_bundle_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_bundle_items (
    id integer NOT NULL,
    combo_product_id integer NOT NULL,
    item_product_id integer NOT NULL,
    item_quantity numeric(12,3) DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.product_bundle_items OWNER TO postgres;

--
-- Name: product_bundle_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_bundle_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_bundle_items_id_seq OWNER TO postgres;

--
-- Name: product_bundle_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_bundle_items_id_seq OWNED BY public.product_bundle_items.id;


--
-- Name: product_cost_price_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_cost_price_histories (
    id integer NOT NULL,
    product_id integer NOT NULL,
    old_cost_price numeric(12,2) NOT NULL,
    new_cost_price numeric(12,2) NOT NULL,
    percent_change numeric(10,4) NOT NULL,
    reason text,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.product_cost_price_histories OWNER TO postgres;

--
-- Name: product_cost_price_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_cost_price_histories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_cost_price_histories_id_seq OWNER TO postgres;

--
-- Name: product_cost_price_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_cost_price_histories_id_seq OWNED BY public.product_cost_price_histories.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    image_data text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.product_images OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_images_id_seq OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_pricing_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_pricing_rules (
    id integer NOT NULL,
    product_id integer NOT NULL,
    rule_name character varying(120) NOT NULL,
    channel_key character varying(80),
    markup_percentage numeric(8,2) DEFAULT 0 NOT NULL,
    suggested_price numeric(12,2) DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.product_pricing_rules OWNER TO postgres;

--
-- Name: product_pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_pricing_rules_id_seq OWNER TO postgres;

--
-- Name: product_pricing_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_pricing_rules_id_seq OWNED BY public.product_pricing_rules.id;


--
-- Name: product_suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_suppliers (
    id integer NOT NULL,
    product_id integer NOT NULL,
    supplier_id integer NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.product_suppliers OWNER TO postgres;

--
-- Name: product_suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_suppliers_id_seq OWNER TO postgres;

--
-- Name: product_suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_suppliers_id_seq OWNED BY public.product_suppliers.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(180) NOT NULL,
    sku character varying(60) NOT NULL,
    sku_type character varying(20) DEFAULT 'SINGLE'::character varying NOT NULL,
    product_code character varying(80),
    barcode character varying(80),
    image_data text,
    description text,
    usage_guide text,
    pros text,
    cons text,
    category_id integer,
    unit character varying(30) DEFAULT 'pcs'::character varying NOT NULL,
    cost_price numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    markup_percentage numeric(8,2) DEFAULT 0 NOT NULL,
    suggested_price numeric(12,2) DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    brand_id integer
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: shipping_shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipping_shipments (
    id integer NOT NULL,
    channel character varying(30),
    marketplace_order_id integer,
    shipment_status character varying(40) DEFAULT 'PENDING'::character varying NOT NULL,
    carrier character varying(80),
    service_level character varying(80),
    tracking_no character varying(120),
    label_url text,
    shipped_at timestamp without time zone,
    delivered_at timestamp without time zone,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.shipping_shipments OWNER TO postgres;

--
-- Name: shipping_shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shipping_shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipping_shipments_id_seq OWNER TO postgres;

--
-- Name: shipping_shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shipping_shipments_id_seq OWNED BY public.shipping_shipments.id;


--
-- Name: stock_count_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_count_items (
    id integer NOT NULL,
    stock_count_id integer NOT NULL,
    product_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    expected_quantity integer DEFAULT 0 NOT NULL,
    counted_quantity integer,
    difference_quantity integer DEFAULT 0 NOT NULL,
    notes text,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT stock_count_items_counted_quantity_check CHECK ((counted_quantity >= 0)),
    CONSTRAINT stock_count_items_expected_quantity_check CHECK ((expected_quantity >= 0))
);


ALTER TABLE public.stock_count_items OWNER TO postgres;

--
-- Name: stock_count_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_count_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_count_items_id_seq OWNER TO postgres;

--
-- Name: stock_count_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_count_items_id_seq OWNED BY public.stock_count_items.id;


--
-- Name: stock_counts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_counts (
    id integer NOT NULL,
    warehouse_id integer NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    notes text,
    created_by integer,
    completed_by integer,
    applied_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    applied_at timestamp without time zone,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT stock_counts_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'COMPLETED'::character varying, 'APPLIED'::character varying])::text[])))
);


ALTER TABLE public.stock_counts OWNER TO postgres;

--
-- Name: stock_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_counts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_counts_id_seq OWNER TO postgres;

--
-- Name: stock_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_counts_id_seq OWNED BY public.stock_counts.id;


--
-- Name: stock_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_levels (
    id integer NOT NULL,
    product_id integer NOT NULL,
    warehouse_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    allocated_quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT stock_levels_allocated_quantity_check CHECK ((allocated_quantity >= 0)),
    CONSTRAINT stock_levels_quantity_check CHECK ((quantity >= 0))
);


ALTER TABLE public.stock_levels OWNER TO postgres;

--
-- Name: stock_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_levels_id_seq OWNER TO postgres;

--
-- Name: stock_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_levels_id_seq OWNED BY public.stock_levels.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id integer NOT NULL,
    movement_type character varying(20) NOT NULL,
    product_id integer NOT NULL,
    source_warehouse_id integer,
    destination_warehouse_id integer,
    quantity integer NOT NULL,
    reference_no character varying(80),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    supplier_id integer,
    unit_cost numeric(12,2),
    purchase_reason text,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying, 'TRANSFER'::character varying])::text[]))),
    CONSTRAINT stock_movements_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movements_id_seq OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: supplier_brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_brands (
    supplier_id integer NOT NULL,
    brand_id integer NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.supplier_brands OWNER TO postgres;

--
-- Name: supplier_invoice_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_invoice_attachments (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.supplier_invoice_attachments OWNER TO postgres;

--
-- Name: supplier_invoice_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_invoice_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_invoice_attachments_id_seq OWNER TO postgres;

--
-- Name: supplier_invoice_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_invoice_attachments_id_seq OWNED BY public.supplier_invoice_attachments.id;


--
-- Name: supplier_invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_invoice_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    product_id integer,
    item_code character varying(120),
    description text,
    serial_no character varying(200),
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    discount numeric(14,2) DEFAULT 0 NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.supplier_invoice_items OWNER TO postgres;

--
-- Name: supplier_invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_invoice_items_id_seq OWNER TO postgres;

--
-- Name: supplier_invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_invoice_items_id_seq OWNED BY public.supplier_invoice_items.id;


--
-- Name: supplier_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_invoices (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    supplier_id integer NOT NULL,
    do_id integer,
    invoice_no character varying(80) NOT NULL,
    invoice_date date NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    warehouse_id integer,
    posted_to_inventory boolean DEFAULT false NOT NULL
);


ALTER TABLE public.supplier_invoices OWNER TO postgres;

--
-- Name: supplier_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_invoices_id_seq OWNER TO postgres;

--
-- Name: supplier_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_invoices_id_seq OWNED BY public.supplier_invoices.id;


--
-- Name: supplier_payment_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_payment_records (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    paid_date date,
    amount numeric(12,2),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT supplier_payment_records_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT supplier_payment_records_period_year_check CHECK ((period_year >= 2000))
);


ALTER TABLE public.supplier_payment_records OWNER TO postgres;

--
-- Name: supplier_payment_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_payment_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_payment_records_id_seq OWNER TO postgres;

--
-- Name: supplier_payment_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_payment_records_id_seq OWNED BY public.supplier_payment_records.id;


--
-- Name: supplier_payment_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_payment_schedules (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    supplier_id integer NOT NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    due_date date NOT NULL,
    amount_due numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    remind_days_before integer DEFAULT 3 NOT NULL,
    reminder_sent boolean DEFAULT false NOT NULL,
    overdue_reminded_date date,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    monthly_reminded_month integer,
    CONSTRAINT supplier_payment_schedules_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT supplier_payment_schedules_period_year_check CHECK ((period_year >= 2000)),
    CONSTRAINT supplier_payment_schedules_remind_days_before_check CHECK ((remind_days_before >= 0)),
    CONSTRAINT supplier_payment_schedules_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PARTIAL'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying])::text[])))
);


ALTER TABLE public.supplier_payment_schedules OWNER TO postgres;

--
-- Name: supplier_payment_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_payment_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_payment_schedules_id_seq OWNER TO postgres;

--
-- Name: supplier_payment_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_payment_schedules_id_seq OWNED BY public.supplier_payment_schedules.id;


--
-- Name: supplier_return_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_return_attachments (
    id integer NOT NULL,
    return_id integer NOT NULL,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.supplier_return_attachments OWNER TO postgres;

--
-- Name: supplier_return_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_return_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_return_attachments_id_seq OWNER TO postgres;

--
-- Name: supplier_return_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_return_attachments_id_seq OWNED BY public.supplier_return_attachments.id;


--
-- Name: supplier_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_return_items (
    id integer NOT NULL,
    return_id integer NOT NULL,
    product_id integer,
    item_code character varying(120),
    description text,
    serial_no character varying(200),
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.supplier_return_items OWNER TO postgres;

--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_return_items_id_seq OWNER TO postgres;

--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_return_items_id_seq OWNED BY public.supplier_return_items.id;


--
-- Name: supplier_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_returns (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    supplier_id integer NOT NULL,
    doc_type character varying(20) NOT NULL,
    document_no character varying(80) NOT NULL,
    document_date date NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT supplier_returns_doc_type_check CHECK (((doc_type)::text = ANY ((ARRAY['RETURN'::character varying, 'CLAIM'::character varying, 'REPAIR'::character varying])::text[])))
);


ALTER TABLE public.supplier_returns OWNER TO postgres;

--
-- Name: supplier_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_returns_id_seq OWNER TO postgres;

--
-- Name: supplier_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_returns_id_seq OWNED BY public.supplier_returns.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name character varying(180) NOT NULL,
    company_name character varying(180),
    contact_name character varying(120),
    phone character varying(60),
    email character varying(160),
    address text,
    payment_terms text,
    lead_time_days integer DEFAULT 0 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    branch character varying(120),
    business_hours character varying(200),
    parent_company character varying(180),
    map_link text,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT suppliers_lead_time_days_check CHECK ((lead_time_days >= 0))
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: system_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_notifications (
    id integer NOT NULL,
    notification_type character varying(40) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    target_role character varying(20),
    is_read boolean DEFAULT false NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.system_notifications OWNER TO postgres;

--
-- Name: system_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_notifications_id_seq OWNER TO postgres;

--
-- Name: system_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_notifications_id_seq OWNED BY public.system_notifications.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key character varying(120) NOT NULL,
    setting_value text NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(180) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    plan character varying(40) DEFAULT 'FREE'::character varying NOT NULL,
    max_users integer DEFAULT 5 NOT NULL,
    contact_email character varying(160),
    contact_phone character varying(60),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_at timestamp without time zone,
    approved_by integer,
    rejected_reason text,
    rejected_at timestamp without time zone,
    rejected_by integer,
    CONSTRAINT tenants_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'REJECTED'::character varying, 'SUSPENDED'::character varying, 'DELETED'::character varying])::text[])))
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenants_id_seq OWNER TO postgres;

--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name character varying(120) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    preferred_currency character varying(10) DEFAULT 'MYR'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'MANAGER'::character varying, 'STAFF'::character varying, 'SUPER_ADMIN'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouses (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    code character varying(30) NOT NULL,
    address text,
    manager_name character varying(120),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- Name: warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warehouses_id_seq OWNER TO postgres;

--
-- Name: warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: bank_statements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statements ALTER COLUMN id SET DEFAULT nextval('public.bank_statements_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: delivery_order_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_attachments ALTER COLUMN id SET DEFAULT nextval('public.delivery_order_attachments_id_seq'::regclass);


--
-- Name: delivery_order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_items ALTER COLUMN id SET DEFAULT nextval('public.delivery_order_items_id_seq'::regclass);


--
-- Name: delivery_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders ALTER COLUMN id SET DEFAULT nextval('public.delivery_orders_id_seq'::regclass);


--
-- Name: document_prompts id; Type: DEFAULT; Schema: public; Owner: inventory_user
--

ALTER TABLE ONLY public.document_prompts ALTER COLUMN id SET DEFAULT nextval('public.document_prompts_id_seq'::regclass);


--
-- Name: low_stock_alert_states id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states ALTER COLUMN id SET DEFAULT nextval('public.low_stock_alert_states_id_seq'::regclass);


--
-- Name: marketplace_connections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_connections ALTER COLUMN id SET DEFAULT nextval('public.marketplace_connections_id_seq'::regclass);


--
-- Name: marketplace_error_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_error_logs ALTER COLUMN id SET DEFAULT nextval('public.marketplace_error_logs_id_seq'::regclass);


--
-- Name: marketplace_inventory_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_inventory_snapshots ALTER COLUMN id SET DEFAULT nextval('public.marketplace_inventory_snapshots_id_seq'::regclass);


--
-- Name: marketplace_oauth_states id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_oauth_states ALTER COLUMN id SET DEFAULT nextval('public.marketplace_oauth_states_id_seq'::regclass);


--
-- Name: marketplace_order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_order_items ALTER COLUMN id SET DEFAULT nextval('public.marketplace_order_items_id_seq'::regclass);


--
-- Name: marketplace_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_orders ALTER COLUMN id SET DEFAULT nextval('public.marketplace_orders_id_seq'::regclass);


--
-- Name: marketplace_sync_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.marketplace_sync_logs_id_seq'::regclass);


--
-- Name: product_bundle_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_bundle_items ALTER COLUMN id SET DEFAULT nextval('public.product_bundle_items_id_seq'::regclass);


--
-- Name: product_cost_price_histories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_cost_price_histories ALTER COLUMN id SET DEFAULT nextval('public.product_cost_price_histories_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_pricing_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.product_pricing_rules_id_seq'::regclass);


--
-- Name: product_suppliers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers ALTER COLUMN id SET DEFAULT nextval('public.product_suppliers_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: shipping_shipments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_shipments ALTER COLUMN id SET DEFAULT nextval('public.shipping_shipments_id_seq'::regclass);


--
-- Name: stock_count_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items ALTER COLUMN id SET DEFAULT nextval('public.stock_count_items_id_seq'::regclass);


--
-- Name: stock_counts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts ALTER COLUMN id SET DEFAULT nextval('public.stock_counts_id_seq'::regclass);


--
-- Name: stock_levels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_levels ALTER COLUMN id SET DEFAULT nextval('public.stock_levels_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: supplier_invoice_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_attachments ALTER COLUMN id SET DEFAULT nextval('public.supplier_invoice_attachments_id_seq'::regclass);


--
-- Name: supplier_invoice_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_items ALTER COLUMN id SET DEFAULT nextval('public.supplier_invoice_items_id_seq'::regclass);


--
-- Name: supplier_invoices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices ALTER COLUMN id SET DEFAULT nextval('public.supplier_invoices_id_seq'::regclass);


--
-- Name: supplier_payment_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_records ALTER COLUMN id SET DEFAULT nextval('public.supplier_payment_records_id_seq'::regclass);


--
-- Name: supplier_payment_schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_schedules ALTER COLUMN id SET DEFAULT nextval('public.supplier_payment_schedules_id_seq'::regclass);


--
-- Name: supplier_return_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_attachments ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_attachments_id_seq'::regclass);


--
-- Name: supplier_return_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_items_id_seq'::regclass);


--
-- Name: supplier_returns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns ALTER COLUMN id SET DEFAULT nextval('public.supplier_returns_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: system_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_notifications ALTER COLUMN id SET DEFAULT nextval('public.system_notifications_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: warehouses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, user_email, user_role, action, entity_type, entity_id, method, path, description, metadata, created_at, tenant_id) FROM stdin;
1	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-02 15:53:47.462217	\N
2	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-02 15:53:55.874933	\N
3	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-02 16:02:12.620281	\N
4	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-02 16:02:24.739324	\N
5	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-02 16:07:42.371138	\N
6	3	manager@inventory.local	MANAGER	LOGIN	AUTH	3	POST	/api/auth/login	User logged in	{"body": {"email": "manager@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-05 03:39:06.43151	\N
7	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-05 03:39:13.561379	\N
8	2	admin@inventory.local	ADMIN	WAREHOUSES_POST	WAREHOUSES	\N	POST	/api/warehouses	POST /api/warehouses	{"body": {"id": null, "code": "Main001", "name": "Main", "address": "23, Batu 14, Jalan Utama 2/1, Taman Perindustrian Puchong Utama, 47100 Puchong, Selangor", "isActive": true, "managerName": "Junyuan"}, "statusCode": 201}	2026-05-05 03:40:02.646186	1
9	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-06 05:35:53.840906	\N
10	2	admin@inventory.local	ADMIN	DOCUMENTS_POST	DOCUMENTS	parse	POST	/api/documents/parse	POST /api/documents/parse	{"body": {}, "statusCode": 200}	2026-05-06 05:56:38.721528	1
11	2	admin@inventory.local	ADMIN	DOCUMENTS_POST	DOCUMENTS	parse	POST	/api/documents/parse	POST /api/documents/parse	{"body": {}, "statusCode": 200}	2026-05-06 06:21:00.187712	1
12	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-06 10:23:06.087245	\N
13	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-06 11:59:14.25785	\N
14	2	admin@inventory.local	ADMIN	PROMPTS_POST	PROMPTS	\N	POST	/api/prompts	POST /api/prompts	{"body": {"name": "bhj", "content": "gh", "is_default": false}, "statusCode": 201}	2026-05-06 11:59:40.770959	1
15	2	admin@inventory.local	ADMIN	DOCUMENTS_POST	DOCUMENTS	parse	POST	/api/documents/parse	POST /api/documents/parse	{"body": {"model": "llava-phi3:latest"}, "statusCode": 200}	2026-05-06 16:48:34.246792	1
16	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-07 00:37:26.465222	\N
17	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-090", "name": "PU DUCT HOSE 1 1/2 * 6 Meter", "unit": "LIGHTS", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "PUD-38", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 00:42:48.725817	1
18	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	1	POST	/api/delivery-orders	Created delivery order DO-2601073 (stock posted)	{"body": {"do_no": "DO-2601073", "items": [{"quantity": 1, "item_code": "PUD-38", "serial_no": null, "product_id": 90, "description": "PU DUCT HOSE 1 1/2 * 6 Meter"}], "notes": null, "do_date": "2026-01-06", "supplier_id": 40, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 00:42:53.162792	1
19	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	1	POST	/api/supplier-invoices	Created invoice DO-2601073	{"body": {"do_id": 1, "items": [{"discount": 0, "quantity": 1, "item_code": "PUD-38", "serial_no": null, "product_id": 90, "unit_price": 250, "description": "PU DUCT HOSE 1 1/2 * 6 Meter"}], "notes": null, "invoice_no": "DO-2601073", "supplier_id": 40, "invoice_date": "2026-05-07", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 00:44:12.966013	1
20	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_UPDATE	SUPPLIER_INVOICE	1	PUT	/api/supplier-invoices/1	Updated invoice IV-2601073	{"body": {"do_id": 1, "items": [{"discount": 0, "quantity": 1, "item_code": "PUD-38", "serial_no": null, "product_id": 90, "unit_price": 250, "description": "PU DUCT HOSE 1 1/2 * 6 Meter"}], "notes": null, "invoice_no": "IV-2601073", "supplier_id": 40, "invoice_date": "2026-05-06", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 200}	2026-05-07 00:44:28.924097	1
21	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKY-0091", "name": "DUST HOSE 1-1/4\\" * 6 Meter", "unit": "LGTHS", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "PUD-32", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 00:46:27.87123	1
22	2	admin@inventory.local	ADMIN	SUPPLIER_RETURN_CREATE	SUPPLIER_RETURN	1	POST	/api/supplier-returns	Created RETURN document INV-2512170	{"body": {"items": [{"quantity": 1, "item_code": "PUD-32", "serial_no": null, "product_id": 91, "description": "DUST HOSE 1-1/4\\" * 6 Meter"}], "notes": null, "doc_type": "RETURN", "document_no": "INV-2512170", "supplier_id": 40, "document_date": "2026-01-06"}, "statusCode": 201}	2026-05-07 00:46:38.367979	1
23	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-100", "name": "AIKOKI BRUSHLESS CORDLESS IMPACT DRILL SET", "unit": "UNIT", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "AT010B", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 00:48:34.750729	1
24	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	2	POST	/api/delivery-orders	Created delivery order DO-202601/0016 (stock posted)	{"body": {"do_no": "DO-202601/0016", "items": [{"quantity": 1, "item_code": "AT010B", "serial_no": null, "product_id": 92, "description": "AIKOKI BRUSHLESS CORDLESS IMPACT DRILL SET"}], "notes": null, "do_date": "2026-01-02", "supplier_id": 52, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 00:48:38.025249	1
25	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	2	POST	/api/supplier-invoices	Created invoice I-202601/0016	{"body": {"do_id": 2, "items": [{"discount": 0, "quantity": 2, "item_code": "AT010B", "serial_no": null, "product_id": 92, "unit_price": 130, "description": "AIKOKI BRUSHLESS CORDLESS IMPACT DRILL SET"}], "notes": null, "invoice_no": "I-202601/0016", "supplier_id": 52, "invoice_date": "2026-01-02", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 00:49:12.440756	1
26	2	admin@inventory.local	ADMIN	SUPPLIER_CREATE	SUPPLIER	67	POST	/api/suppliers	Created supplier HELIMAC SDN BHD	{"body": {"name": "HELIMAC SDN BHD", "email": "", "notes": "", "phone": "", "branch": "", "address": "", "mapLink": "", "brandIds": [], "isActive": true, "contactName": "", "leadTimeDays": 0, "paymentTerms": "", "businessHours": "", "parentCompany": ""}, "statusCode": 201}	2026-05-07 00:49:56.616503	1
27	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-102", "name": "KING MIG WIRE ER70S-6 0.8mm WHITE BOX (5KG)", "unit": "ROLL", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "WCWM70085", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 00:51:49.70151	1
28	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-103", "name": "KING MIG WIRE ER70S-6 0.8m (15KG)", "unit": "ROLL", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "WCWM7008", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 00:52:53.937699	1
29	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-104", "name": "TAKADA WELD M/S ELECTRODE 6013/2.5mm 1*20kg", "unit": "KG", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "WCE601325T", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 00:54:10.278297	1
30	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	3	POST	/api/delivery-orders	Created delivery order DO-50415 (stock posted)	{"body": {"do_no": "DO-50415", "items": [{"quantity": 3, "item_code": "WCWM70085", "serial_no": null, "product_id": 93, "description": "KING MIG WIRE ER70S-6 0.8mm WHITE BOX (5KG)"}, {"quantity": 2, "item_code": "WCWM7008", "serial_no": null, "product_id": 95, "description": "KING MIG WIRE ER70S-6 0.8m (15KG)"}, {"quantity": 20, "item_code": "WCE601325T", "serial_no": null, "product_id": 96, "description": "TAKADA WELD M/S ELECTRODE 6013/2.5mm 1*20kg"}], "notes": null, "do_date": "2026-01-02", "supplier_id": 67, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 00:54:14.705862	1
31	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	3	POST	/api/supplier-invoices	Created invoice IV-49272	{"body": {"do_id": 3, "items": [{"discount": 0, "quantity": 3, "item_code": "WCWM70085", "serial_no": null, "product_id": 93, "unit_price": 32, "description": "KING MIG WIRE ER70S-6 0.8mm WHITE BOX (5KG)"}, {"discount": 0, "quantity": 2, "item_code": "WCWM7008", "serial_no": null, "product_id": 95, "unit_price": 72, "description": "KING MIG WIRE ER70S-6 0.8m (15KG)"}, {"discount": 0, "quantity": 20, "item_code": "WCE601325T", "serial_no": null, "product_id": 96, "unit_price": 6, "description": "TAKADA WELD M/S ELECTRODE 6013/2.5mm 1*20kg"}], "notes": null, "invoice_no": "IV-49272", "supplier_id": 67, "invoice_date": "2026-01-02", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 00:55:04.528207	1
32	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-07 04:16:53.924221	\N
33	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-P001", "name": "BOSSCO AUTO SUB.PUMP 3\\" 2HP 415V", "unit": "UNIT", "brandId": 13, "isActive": true, "costPrice": 0, "productCode": "DS-20A-3", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 04:26:59.961897	1
34	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	4	POST	/api/delivery-orders	Created delivery order IN0212425 (stock posted)	{"body": {"do_no": "IN0212425", "items": [{"quantity": 2, "item_code": "DS-20A-3", "serial_no": null, "product_id": 97, "description": "BOSSCO AUTO SUB.PUMP 3\\" 2HP 415V"}], "notes": null, "do_date": "2026-05-07", "supplier_id": 55, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 04:27:12.973536	1
35	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	4	POST	/api/supplier-invoices	Created invoice IN0212425	{"body": {"do_id": 4, "items": [{"discount": 0, "quantity": 2, "item_code": "DS-20A-3", "serial_no": null, "product_id": 97, "unit_price": 1500, "description": "BOSSCO AUTO SUB.PUMP 3\\" 2HP 415V"}], "notes": null, "invoice_no": "IN0212425", "supplier_id": 55, "invoice_date": "2026-01-02", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 04:27:48.044101	1
36	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_UPDATE	DELIVERY_ORDER	4	PUT	/api/delivery-orders/4	Updated delivery order IN0212425	{"body": {"do_no": "IN0212425", "items": [{"quantity": 2, "item_code": "DS-20A-3", "serial_no": null, "product_id": 97, "description": "BOSSCO AUTO SUB.PUMP 3\\" 2HP 415V"}], "notes": null, "do_date": "2026-01-02", "supplier_id": 55, "warehouse_id": 1}, "statusCode": 200}	2026-05-07 04:28:08.724277	1
37	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-P002", "name": "NEOVIN PRESSURE CONTROLLER 1.1KW", "unit": "UNIT", "brandId": null, "isActive": true, "costPrice": 0, "description": "6 UNIT S/NO: 25.P86B2332984, 25.P86B2332988, 25.P86B2332985, 25.P86B2332980, 25.P86B2332983, 25.P86B2332987", "productCode": "P86H1", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 04:32:33.867395	1
38	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-P003", "name": "NEOVIN PRESSURE SWITCH 3/8\\" female for P150B2", "unit": "UNIT", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "PS-3H", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 04:33:55.493253	1
39	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	5	POST	/api/delivery-orders	Created delivery order IN0212353 (stock posted)	{"body": {"do_no": "IN0212353", "items": [{"quantity": 6, "item_code": "P86H1", "serial_no": null, "product_id": 98, "description": "NEOVIN PRESSURE CONTROLLER 1.1KW"}, {"quantity": 3, "item_code": "PS-3H", "serial_no": null, "product_id": 99, "description": "NEOVIN PRESSURE SWITCH 3/8\\" female for P150B2"}], "notes": null, "do_date": "2026-01-02", "supplier_id": 55, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 04:34:02.118517	1
40	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	5	POST	/api/supplier-invoices	Created invoice IN0212353	{"body": {"do_id": 5, "items": [{"discount": 0, "quantity": 6, "item_code": "P86H1", "serial_no": null, "product_id": 98, "unit_price": 75, "description": "NEOVIN PRESSURE CONTROLLER 1.1KW"}, {"discount": 0, "quantity": 3, "item_code": "PS-3H", "serial_no": null, "product_id": 99, "unit_price": 10, "description": "NEOVIN PRESSURE SWITCH 3/8\\" female for P150B2"}], "notes": null, "invoice_no": "IN0212353", "supplier_id": 55, "invoice_date": "2026-01-02", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 04:37:08.918191	1
41	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-TT001", "name": "IMPACT SOCKET 1/2\\" 14.5mm TT CRMO(DEEP) H21", "unit": "pcs", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "IS1/2D-TT14.5H", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 07:15:19.68094	1
42	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	6	POST	/api/delivery-orders	Created delivery order IV-149460 (stock posted)	{"body": {"do_no": "IV-149460", "items": [{"quantity": 5, "item_code": "IS1/2D-TT14.5H", "serial_no": null, "product_id": 100, "description": "IMPACT SOCKET 1/2\\" 14.5mm TT CRMO(DEEP) H21"}], "notes": null, "do_date": "2026-05-07", "supplier_id": 39, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 07:15:25.741973	1
43	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	6	POST	/api/supplier-invoices	Created invoice IV-149460	{"body": {"do_id": 6, "items": [{"discount": 0, "quantity": 5, "item_code": "IS1/2D-TT14.5H", "serial_no": null, "product_id": 100, "unit_price": 10.5, "description": "IMPACT SOCKET 1/2\\" 14.5mm TT CRMO(DEEP) H21"}], "notes": null, "invoice_no": "IV-149460", "supplier_id": 39, "invoice_date": "2026-05-07", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 09:03:23.808047	1
44	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-SR001", "name": "TRANSMAX WORM GEAR SPEED REDUCER", "unit": "pcs", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "TNRV030-P090111-030.0", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 09:13:29.006294	1
45	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	7	POST	/api/delivery-orders	Created delivery order CO/DO/204785 (stock posted)	{"body": {"do_no": "CO/DO/204785", "items": [{"quantity": 1, "item_code": "TNRV030-P090111-030.0", "serial_no": null, "product_id": 101, "description": "TRANSMAX WORM GEAR SPEED REDUCER"}], "notes": null, "do_date": "2026-01-06", "supplier_id": 45, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 09:13:32.247929	1
46	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	7	POST	/api/supplier-invoices	Created invoice CO/IN/251955	{"body": {"do_id": 7, "items": [{"discount": 0, "quantity": 1, "item_code": "TNRV030-P090111-030.0", "serial_no": null, "product_id": 101, "unit_price": 165, "description": "TRANSMAX WORM GEAR SPEED REDUCER"}], "notes": null, "invoice_no": "CO/IN/251955", "supplier_id": 45, "invoice_date": "2026-01-06", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 09:14:09.564373	1
47	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_UPDATE	DELIVERY_ORDER	6	PUT	/api/delivery-orders/6	Updated delivery order IV-149460	{"body": {"do_no": "IV-149460", "items": [{"quantity": 5, "item_code": "IS1/2D-TT14.5H", "serial_no": null, "product_id": 100, "description": "IMPACT SOCKET 1/2\\" 14.5mm TT CRMO(DEEP) H21"}], "notes": null, "do_date": "2026-01-08", "supplier_id": 39, "warehouse_id": 1}, "statusCode": 200}	2026-05-07 09:15:07.046165	1
48	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-TW001", "name": "TANK WHEEL FOR SV-202(IK) DP510312011", "unit": "pcs", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "DP510312011", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 09:17:06.840415	1
49	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	8	POST	/api/delivery-orders	Created delivery order 26601/0216 (stock posted)	{"body": {"do_no": "26601/0216", "items": [{"quantity": 4, "item_code": "DP510312011", "serial_no": null, "product_id": 102, "description": "TANK WHEEL FOR SV-202(IK) DP510312011"}], "notes": null, "do_date": "2026-01-05", "supplier_id": 36, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 09:17:10.616441	1
50	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-HT001", "name": "SKC HAND TAP M 8*1.25", "unit": "pcs", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "654000108013", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 09:19:21.30697	1
51	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_CREATE	DELIVERY_ORDER	9	POST	/api/delivery-orders	Created delivery order J02317 (stock posted)	{"body": {"do_no": "J02317", "items": [{"quantity": 2, "item_code": "654000108013", "serial_no": null, "product_id": 103, "description": "SKC HAND TAP M 8*1.25"}], "notes": null, "do_date": "2026-01-22", "supplier_id": 58, "warehouse_id": 1}, "statusCode": 201}	2026-05-07 09:19:27.236082	1
52	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-HT002", "name": "SKC HAND TAP BSW 16* 3/8", "unit": "SET", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "654000201016", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 09:20:44.195863	1
53	2	admin@inventory.local	ADMIN	PRODUCTS_POST	PRODUCTS	\N	POST	/api/products	POST /api/products	{"body": {"sku": "SKU-DS001", "name": "M10 3/8 DEEP SOCKET 12PT-MM 8*KD", "unit": "pcs", "brandId": null, "isActive": true, "costPrice": 0, "productCode": "010001106008", "reorderLevel": 0, "sellingPrice": 0, "suggestedPrice": 0, "markupPercentage": 0}, "statusCode": 201}	2026-05-07 09:21:35.951083	1
54	2	admin@inventory.local	ADMIN	DELIVERY_ORDER_UPDATE	DELIVERY_ORDER	9	PUT	/api/delivery-orders/9	Updated delivery order J02317	{"body": {"do_no": "J02317", "items": [{"quantity": 2, "item_code": "654000108013", "serial_no": null, "product_id": 103, "description": "SKC HAND TAP M 8*1.25"}, {"quantity": 1, "item_code": "654000201016", "serial_no": null, "product_id": 104, "description": "SKC HAND TAP BSW 16* 3/8"}, {"quantity": 2, "item_code": "010001106008", "serial_no": null, "product_id": 105, "description": "M10 3/8 DEEP SOCKET 12PT-MM 8*KD"}], "notes": null, "do_date": "2026-01-21", "supplier_id": 58, "warehouse_id": 1}, "statusCode": 200}	2026-05-07 09:21:40.689135	1
55	2	admin@inventory.local	ADMIN	SUPPLIER_INVOICE_CREATE	SUPPLIER_INVOICE	8	POST	/api/supplier-invoices	Created invoice J02317	{"body": {"do_id": 9, "items": [{"discount": 30, "quantity": 2, "item_code": "654000108013", "serial_no": null, "product_id": 103, "unit_price": 27.2, "description": "SKC HAND TAP M 8*1.25"}, {"discount": 30, "quantity": 1, "item_code": "654000201016", "serial_no": null, "product_id": 104, "unit_price": 33.6, "description": "SKC HAND TAP BSW 16* 3/8"}, {"discount": 25, "quantity": 2, "item_code": "010001106008", "serial_no": null, "product_id": 105, "unit_price": 14, "description": "M10 3/8 DEEP SOCKET 12PT-MM 8*KD"}], "notes": null, "invoice_no": "J02317", "supplier_id": 58, "invoice_date": "2026-01-22", "warehouse_id": null, "post_to_inventory": false}, "statusCode": 201}	2026-05-07 09:23:00.090769	1
56	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-07 11:30:32.702205	\N
57	2	admin@inventory.local	ADMIN	STOCK_COUNT_CREATE	STOCK_COUNT	1	POST	/api/stock-counts	Created stock count #1	{"body": {"notes": "", "warehouseId": 1}, "statusCode": 201}	2026-05-07 11:34:32.953866	1
58	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-08 08:34:14.219054	\N
59	2	admin@inventory.local	ADMIN	PAYMENT_SCHEDULE_BATCH_CREATE	PAYMENT_SCHEDULE	37	POST	/api/supplier-payment-schedules/batch	Batch created 4 schedule(s) for supplier #37 (2026 1-12 every 3m)	{"body": {"year": 2026, "dueDay": 15, "endMonth": 12, "startMonth": 1, "supplierId": 37, "periodInterval": 3, "amountPerPeriod": 3000, "remindDaysBefore": 3}, "statusCode": 201}	2026-05-08 08:55:01.360421	1
60	2	admin@inventory.local	ADMIN	PAYMENT_SCHEDULE_BATCH_CREATE	PAYMENT_SCHEDULE	37	POST	/api/supplier-payment-schedules/batch	Batch created 0 schedule(s) for supplier #37 (2026 1-12 every 3m)	{"body": {"year": 2026, "dueDay": 15, "endMonth": 12, "startMonth": 1, "supplierId": 37, "periodInterval": 3, "amountPerPeriod": 3000, "remindDaysBefore": 3}, "statusCode": 201}	2026-05-08 08:55:27.947196	1
61	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-08 09:00:30.135329	\N
62	2	admin@inventory.local	ADMIN	LOGIN	AUTH	2	POST	/api/auth/login	User logged in	{"body": {"email": "admin@inventory.local", "password": "[REDACTED]", "tenantCode": "DEFAULT"}, "statusCode": 200}	2026-05-08 09:00:59.498289	\N
\.


--
-- Data for Name: bank_statements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_statements (id, uploaded_by, statement_month, original_name, storage_path, mime_type, file_size, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brands (id, tenant_id, name, description, is_active, created_at, updated_at, country, made_in) FROM stdin;
1	1	Epple	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
2	1	Europower	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
3	1	Eurox	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
4	1	EuroX Air Plus	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
5	1	EuroX Gold	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
6	1	Robintec	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
7	1	HISAKI	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
8	1	TOKU	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	Japan	Japan
9	1	HISAKI Air Tool	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
10	1	PROCUT	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	England	Ireland
11	1	TRELAWNY	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	UK	UK
12	1	YAMAMOTO	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	Taiwan	Taiwan
13	1	Bossco	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	Taiwan	Taiwan
14	1	TARANGIN	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
15	1	CH TOOLS	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
16	1	FOUR M	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
17	1	HOMAI	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
18	1	HUMHON	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
19	1	JETMAC	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
20	1	LONG XING	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
21	1	ROMEO PROFESSIONAL	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
22	1	SEMPROX	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
23	1	Sorrano	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
24	1	JET	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
25	1	Elite	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
26	1	Loncin	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
27	1	Yato	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
28	1	kobei	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
29	1	JIANDONG	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
30	1	SIFANG	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
31	1	TONANCO	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
32	1	ENGA	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
33	1	DELTA	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
34	1	EVERGUSH	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
35	1	HAILEA	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
36	1	SHIMGE	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
37	1	PIUSI	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
38	1	MAIDE	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
39	1	CKS	\N	t	2026-05-04 06:07:56.364555+00	2026-05-04 06:07:56.364555+00	\N	\N
40	1	Pedrollo	意大利知名水泵品牌	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
41	1	Pumpman	专业水泵制造商	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
42	1	Stream	流体控制解决方案品牌	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
43	1	Unoflow	高效水泵技术品牌	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
44	1	Opalflo	工业水泵品牌	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
45	1	Kawamoto	日本水泵制造商	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
46	1	Meudy	专业水泵品牌	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
47	1	Showfou	水泵设备品牌	t	2026-05-04 11:34:20.802088+00	2026-05-04 11:34:20.802088+00	\N	\N
48	1	Benma	清洁设备/发电机制造商	t	2026-05-04 11:34:20.811747+00	2026-05-04 11:34:20.811747+00	\N	\N
49	1	Kranzle	德国高压清洗机品牌	t	2026-05-04 11:34:20.811747+00	2026-05-04 11:34:20.811747+00	\N	\N
50	1	Kama	套丝机/发电机专业制造商	t	2026-05-04 11:34:20.812538+00	2026-05-04 11:34:20.812538+00	\N	\N
51	1	Qing Yang	中国套丝机品牌	t	2026-05-04 11:34:20.812538+00	2026-05-04 11:34:20.812538+00	\N	\N
52	1	ZhongYue	电动工具品牌	t	2026-05-04 11:34:20.813175+00	2026-05-04 11:34:20.813175+00	\N	\N
53	1	Golden Bull	食品加工设备品牌	t	2026-05-04 11:34:20.813657+00	2026-05-04 11:34:20.813657+00	\N	\N
54	1	Golden Tortoise	食品机械品牌	t	2026-05-04 11:34:20.813657+00	2026-05-04 11:34:20.813657+00	\N	\N
55	1	Greenco	绿色机械设备品牌	t	2026-05-04 11:34:20.814206+00	2026-05-04 11:34:20.814206+00	\N	\N
56	1	Mixtec	混合机械设备品牌	t	2026-05-04 11:34:20.814206+00	2026-05-04 11:34:20.814206+00	\N	\N
57	1	SiFang	四方机械设备品牌	t	2026-05-04 11:34:20.814206+00	2026-05-04 11:34:20.814206+00	\N	\N
58	1	WestLing	西方机械设备品牌	t	2026-05-04 11:34:20.814206+00	2026-05-04 11:34:20.814206+00	\N	\N
59	1	Wufu	五福机械设备品牌	t	2026-05-04 11:34:20.814206+00	2026-05-04 11:34:20.814206+00	\N	\N
60	1	Varem	意大利压力罐品牌	t	2026-05-04 11:34:20.815105+00	2026-05-04 11:34:20.815105+00	\N	\N
61	1	ZongShen	宗申发动机品牌	t	2026-05-04 11:34:20.815638+00	2026-05-04 11:34:20.815638+00	\N	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, description, created_at, tenant_id, parent_id) FROM stdin;
7	Airless Paint Sprayer(无气喷涂机)	\N	2026-05-04 06:07:56.364555	1	183
10	Diesel Tower Light(柴油塔灯)	\N	2026-05-04 06:07:56.364555	1	189
17	Plunger Pump(柱塞泵)	\N	2026-05-04 06:07:56.364555	1	185
84	Woodworking Machines(木工机械)	\N	2026-05-04 06:07:56.364555	1	188
183	Cleaning Equipment(清洁设备)	\N	2026-05-04 06:17:53.933162	1	\N
184	Engines & Generators(引擎与发电机)	\N	2026-05-04 06:17:53.933162	1	\N
185	Pumps & Water Systems(水泵与水系统)	\N	2026-05-04 06:17:53.933162	1	\N
186	Air Compressors & Pneumatic Tools(空压机与气动工具)	\N	2026-05-04 06:17:53.933162	1	\N
187	Welding Equipment(焊接设备)	\N	2026-05-04 06:17:53.933162	1	\N
188	Power Tools & Machinery(电动工具与机械)	\N	2026-05-04 06:17:53.933162	1	\N
189	Construction Equipment(建筑设备)	\N	2026-05-04 06:17:53.933162	1	\N
190	Lifting & Hoisting Equipment(起重与吊装设备)	\N	2026-05-04 06:17:53.933162	1	\N
191	Bearings, Belts & Transmission(轴承、皮带与传动)	\N	2026-05-04 06:17:53.933162	1	\N
192	Metalworking Tools(金属加工工具)	\N	2026-05-04 06:17:53.933162	1	\N
193	Workshop & Hand Tools(车间与手动工具)	\N	2026-05-04 06:17:53.933162	1	\N
194	Cutting & Grinding Tools(切割与研磨工具)	\N	2026-05-04 06:17:53.933162	1	\N
195	Garden & Agriculture Tools(园艺与农业工具)	\N	2026-05-04 06:17:53.933162	1	\N
196	Fasteners & Hardware(紧固件与五金)	\N	2026-05-04 06:17:53.933162	1	\N
197	Miscellaneous(其他)	\N	2026-05-04 06:17:53.933162	1	\N
1	Carpet Cleaner(地毯清洗机)	\N	2026-05-04 06:07:56.364555	1	183
3	Floor Dryer(地面烘干机)	\N	2026-05-04 06:07:56.364555	1	183
4	High Pressure Washer(高压清洗机)	\N	2026-05-04 06:07:56.364555	1	183
5	Vacuum Cleaner(吸尘器)	\N	2026-05-04 06:07:56.364555	1	183
13	Floor Polisher(地面抛光机)	\N	2026-05-04 06:07:56.364555	1	183
18	Snow Wash Tank(洗车泡沫罐)	\N	2026-05-04 06:07:56.364555	1	183
81	Car Polishing(汽车抛光)	\N	2026-05-04 06:07:56.364555	1	183
2	Gasoline Engine(汽油发动机)	\N	2026-05-04 06:07:56.364555	1	184
8	Diesel Engine(柴油发动机)	\N	2026-05-04 06:07:56.364555	1	184
9	Diesel Generator(柴油发电机)	\N	2026-05-04 06:07:56.364555	1	184
14	Gasoline Generator(汽油发电机)	\N	2026-05-04 06:07:56.364555	1	184
26	Generator(发电机)	\N	2026-05-04 06:07:56.364555	1	184
140	Induction Motor(感应电机)	\N	2026-05-04 06:07:56.364555	1	184
141	Alternator(交流发电机)	\N	2026-05-04 06:07:56.364555	1	184
11	Diesel Water Pump(柴油水泵)	\N	2026-05-04 06:07:56.364555	1	185
15	Gasoline Water Pump(汽油水泵)	\N	2026-05-04 06:07:56.364555	1	185
58	Water Pump(水泵)	\N	2026-05-04 06:07:56.364555	1	185
59	Booster Pump(增压泵)	\N	2026-05-04 06:07:56.364555	1	185
60	Swimming Pool Products(游泳池产品)	\N	2026-05-04 06:07:56.364555	1	185
61	Waste Water Pump(废水泵)	\N	2026-05-04 06:07:56.364555	1	185
62	Non-Clogging Pump(无堵塞泵)	\N	2026-05-04 06:07:56.364555	1	185
63	Gardening Pump(园艺泵)	\N	2026-05-04 06:07:56.364555	1	185
64	Sand Filter(砂滤器)	\N	2026-05-04 06:07:56.364555	1	185
65	Horizontal Multi-stage Pump(卧式多级泵)	\N	2026-05-04 06:07:56.364555	1	185
66	Control Constant Pressure(恒压控制)	\N	2026-05-04 06:07:56.364555	1	185
67	Sewage Pump(污水泵)	\N	2026-05-04 06:07:56.364555	1	185
68	Sewage Cutter Pump(污水切割泵)	\N	2026-05-04 06:07:56.364555	1	185
69	Under Water Light(水下灯)	\N	2026-05-04 06:07:56.364555	1	185
142	Auto Booster Pump(自动增压泵)	\N	2026-05-04 06:07:56.364555	1	185
143	Bare Pump(裸泵)	\N	2026-05-04 06:07:56.364555	1	185
144	Diaphragm Pressure Tanks(隔膜压力罐)	\N	2026-05-04 06:07:56.364555	1	185
145	Immersion Pump(潜水泵)	\N	2026-05-04 06:07:56.364555	1	185
146	Sewage Submersible Pump(污水潜水泵)	\N	2026-05-04 06:07:56.364555	1	185
147	Multistage Centrifugal Pump(多级离心泵)	\N	2026-05-04 06:07:56.364555	1	185
149	High Flow Circulating Pump(高流量循环泵)	\N	2026-05-04 06:07:56.364555	1	185
150	External Filters(外置过滤器)	\N	2026-05-04 06:07:56.364555	1	185
151	Vortex Blower(涡流风机)	\N	2026-05-04 06:07:56.364555	1	185
152	Power Air Pump(气动泵)	\N	2026-05-04 06:07:56.364555	1	185
153	Hi-Blow Diaphragm Air Pump(隔膜气泵)	\N	2026-05-04 06:07:56.364555	1	185
154	Surface Booster Pump(表面增压泵)	\N	2026-05-04 06:07:56.364555	1	185
155	Centrifugal Pump(离心泵)	\N	2026-05-04 06:07:56.364555	1	185
156	Self Priming Jet Pump(自吸喷射泵)	\N	2026-05-04 06:07:56.364555	1	185
157	Vertical Multistage Pump(立式多级泵)	\N	2026-05-04 06:07:56.364555	1	185
158	End Suction Pump(端吸泵)	\N	2026-05-04 06:07:56.364555	1	185
159	Meter Nozzle(计量喷嘴)	\N	2026-05-04 06:07:56.364555	1	185
160	Electric Pump(电动泵)	\N	2026-05-04 06:07:56.364555	1	185
161	Automatic Nozzle(自动喷嘴)	\N	2026-05-04 06:07:56.364555	1	185
162	Bilge Pump(舱底泵)	\N	2026-05-04 06:07:56.364555	1	185
163	Hand Pump(手动泵)	\N	2026-05-04 06:07:56.364555	1	185
164	Rotary Hand Pump(旋转手泵)	\N	2026-05-04 06:07:56.364555	1	185
21	Self Priming Pump(自吸泵)	\N	2026-05-04 06:07:56.364555	1	185
22	Submersible Pump(潜水泵)	\N	2026-05-04 06:07:56.364555	1	185
6	Air Compressor(空气压缩机)	\N	2026-05-04 06:07:56.364555	1	186
148	DC Air Compressor(直流空压机)	\N	2026-05-04 06:07:56.364555	1	186
83	Pneumatic Nailer(气动钉枪)	\N	2026-05-04 06:07:56.364555	1	186
124	Pneumatic Tools(气动工具)	\N	2026-05-04 06:07:56.364555	1	186
50	Spray Gun(喷枪)	\N	2026-05-04 06:07:56.364555	1	186
51	Air Nailer(气动钉枪)	\N	2026-05-04 06:07:56.364555	1	186
53	Air Body Saw(气动锯)	\N	2026-05-04 06:07:56.364555	1	186
54	Air Flux Chipper(气动铲)	\N	2026-05-04 06:07:56.364555	1	186
44	Air Drill(气动钻)	\N	2026-05-04 06:07:56.364555	1	186
47	Air Tamper(气动夯实机)	\N	2026-05-04 06:07:56.364555	1	186
45	Air Winch(气动绞车)	\N	2026-05-04 06:07:56.364555	1	186
12	Diesel Welding Generator(柴油焊接发电机)	\N	2026-05-04 06:07:56.364555	1	187
16	Gasoline Welding Generator(汽油焊接发电机)	\N	2026-05-04 06:07:56.364555	1	187
27	Welding Machine(焊接机)	\N	2026-05-04 06:07:56.364555	1	187
76	Welding Gloves(焊接手套)	\N	2026-05-04 06:07:56.364555	1	187
88	Cutting Welding Torches(切割焊接炬)	\N	2026-05-04 06:07:56.364555	1	187
89	Gas Regulator(气体调节器)	\N	2026-05-04 06:07:56.364555	1	187
90	Welding Accessories(焊接配件)	\N	2026-05-04 06:07:56.364555	1	187
80	Cordless Power Tools(无绳电动工具)	\N	2026-05-04 06:07:56.364555	1	188
97	Hammer Drill(冲击钻)	\N	2026-05-04 06:07:56.364555	1	188
48	Angle Grinder(角磨机)	\N	2026-05-04 06:07:56.364555	1	188
49	Rotary Grinder(旋转磨床)	\N	2026-05-04 06:07:56.364555	1	188
46	Impact Wrench(冲击扳手)	\N	2026-05-04 06:07:56.364555	1	188
52	Industrial Sander(工业砂光机)	\N	2026-05-04 06:07:56.364555	1	188
28	Power Cut Machine(切割机)	\N	2026-05-04 06:07:56.364555	1	188
98	CNC Machines(数控机床)	\N	2026-05-04 06:07:56.364555	1	188
125	Power Gasoline Tools(汽油动力工具)	\N	2026-05-04 06:07:56.364555	1	188
24	Concrete Mixer(混凝土搅拌机)	\N	2026-05-04 06:07:56.364555	1	189
25	Mini Mixer(小型搅拌机)	\N	2026-05-04 06:07:56.364555	1	189
29	Concrete Vibrator(混凝土振动器)	\N	2026-05-04 06:07:56.364555	1	189
30	Power Trowel(动力抹平机)	\N	2026-05-04 06:07:56.364555	1	189
31	Drilling Hydraulic(液压钻机)	\N	2026-05-04 06:07:56.364555	1	189
32	Machine Breaker(破碎机)	\N	2026-05-04 06:07:56.364555	1	189
33	Road Cutter(路面切割机)	\N	2026-05-04 06:07:56.364555	1	189
34	Tamping Rammer(打夯机)	\N	2026-05-04 06:07:56.364555	1	189
35	Plate Compactor(平板压实机)	\N	2026-05-04 06:07:56.364555	1	189
36	Floor Scarifier(地面刨铣机)	\N	2026-05-04 06:07:56.364555	1	189
37	Tower Light(塔灯)	\N	2026-05-04 06:07:56.364555	1	189
38	Concrete Breaker(混凝土破碎锤)	\N	2026-05-04 06:07:56.364555	1	189
39	Pick Hammer(镐锤)	\N	2026-05-04 06:07:56.364555	1	189
40	Rock Drill(凿岩机)	\N	2026-05-04 06:07:56.364555	1	189
41	Chipping Hammer(凿毛锤)	\N	2026-05-04 06:07:56.364555	1	189
43	Baby Hammer(小锤)	\N	2026-05-04 06:07:56.364555	1	189
19	Bar Cutter(钢筋切断机)	\N	2026-05-04 06:07:56.364555	1	189
23	Bar Bender(钢筋弯曲机)	\N	2026-05-04 06:07:56.364555	1	189
20	Diamond Blade(金刚石锯片)	\N	2026-05-04 06:07:56.364555	1	189
86	Point Chisel(尖凿)	\N	2026-05-04 06:07:56.364555	1	189
96	Renovation Tools(翻新工具)	\N	2026-05-04 06:07:56.364555	1	189
42	Chain Hoist(链式葫芦)	\N	2026-05-04 06:07:56.364555	1	190
182	Pallet Truck(托盘车)	\N	2026-05-04 06:07:56.364555	1	190
165	Electric Hoist(电动葫芦)	\N	2026-05-04 06:07:56.364555	1	190
166	Hand Winch(手动绞车)	\N	2026-05-04 06:07:56.364555	1	190
167	Level Block(水平块)	\N	2026-05-04 06:07:56.364555	1	190
168	Plain Pulley(普通滑轮)	\N	2026-05-04 06:07:56.364555	1	190
169	High Speed Windlass(高速绞车)	\N	2026-05-04 06:07:56.364555	1	190
99	Lifting Systems Equipment(起重系统设备)	\N	2026-05-04 06:07:56.364555	1	190
133	Bearing(轴承)	\N	2026-05-04 06:07:56.364555	1	191
135	Couplings(联轴器)	\N	2026-05-04 06:07:56.364555	1	191
136	Industrial Power Transmission Belts(工业传动带)	\N	2026-05-04 06:07:56.364555	1	191
137	Pulley(滑轮)	\N	2026-05-04 06:07:56.364555	1	191
138	Gear Grease Gun(齿轮黄油枪)	\N	2026-05-04 06:07:56.364555	1	191
139	Roller Chain Sprocket(滚子链轮)	\N	2026-05-04 06:07:56.364555	1	191
173	Pillow Block(轴承座)	\N	2026-05-04 06:07:56.364555	1	191
174	Transmission Belt(传动带)	\N	2026-05-04 06:07:56.364555	1	191
175	Conveyor Belt(输送带)	\N	2026-05-04 06:07:56.364555	1	191
176	Link Chains(链环)	\N	2026-05-04 06:07:56.364555	1	191
177	Roller Chain(滚子链)	\N	2026-05-04 06:07:56.364555	1	191
178	Flexible Coupling(柔性联轴器)	\N	2026-05-04 06:07:56.364555	1	191
179	MH Chain Coupling(MH链条联轴器)	\N	2026-05-04 06:07:56.364555	1	191
180	MH Rubber Coupling(MH橡胶联轴器)	\N	2026-05-04 06:07:56.364555	1	191
181	Marine Cutless Bearing(船用轴承)	\N	2026-05-04 06:07:56.364555	1	191
70	Annular Cutter(环形铣刀)	\N	2026-05-04 06:07:56.364555	1	192
71	Magnetic Drill(磁座钻)	\N	2026-05-04 06:07:56.364555	1	192
72	Pilot Pin(导销)	\N	2026-05-04 06:07:56.364555	1	192
82	Metal Working Machines(金属加工机械)	\N	2026-05-04 06:07:56.364555	1	192
100	Metalworking Drilling(金属加工钻削)	\N	2026-05-04 06:07:56.364555	1	192
101	Metalworking Finishing(金属加工精加工)	\N	2026-05-04 06:07:56.364555	1	192
102	Metalworking Metalforming(金属加工成型)	\N	2026-05-04 06:07:56.364555	1	192
103	Metalworking Milling(金属加工铣削)	\N	2026-05-04 06:07:56.364555	1	192
104	Metalworking Sawing(金属加工锯切)	\N	2026-05-04 06:07:56.364555	1	192
105	Metalworking Turning(金属加工车削)	\N	2026-05-04 06:07:56.364555	1	192
87	Workshop Equipments(车间设备)	\N	2026-05-04 06:07:56.364555	1	193
106	Shop Tools Equipment(车间工具设备)	\N	2026-05-04 06:07:56.364555	1	193
107	Clamps & Vices(夹具与台虎钳)	\N	2026-05-04 06:07:56.364555	1	193
108	Cutters(切割工具)	\N	2026-05-04 06:07:56.364555	1	193
109	Drill Tap Die(钻丝锥模具)	\N	2026-05-04 06:07:56.364555	1	193
110	Electrician Tools(电工工具)	\N	2026-05-04 06:07:56.364555	1	193
111	Fastening Tools(紧固工具)	\N	2026-05-04 06:07:56.364555	1	193
112	File Tools(锉刀工具)	\N	2026-05-04 06:07:56.364555	1	193
113	Garden Tools(园艺工具)	\N	2026-05-04 06:07:56.364555	1	193
115	Hammers Chisel(锤凿)	\N	2026-05-04 06:07:56.364555	1	193
117	Hex Torx Key(六角梅花扳手)	\N	2026-05-04 06:07:56.364555	1	193
118	Hydraulic Tools(液压工具)	\N	2026-05-04 06:07:56.364555	1	193
119	Impact Sockets(冲击套筒)	\N	2026-05-04 06:07:56.364555	1	193
120	Insulated Tools(绝缘工具)	\N	2026-05-04 06:07:56.364555	1	193
121	Measuring Tools(测量工具)	\N	2026-05-04 06:07:56.364555	1	193
122	Non-sparking Tools(防爆工具)	\N	2026-05-04 06:07:56.364555	1	193
123	Pliers Pipe Wrenches(钳子与管钳)	\N	2026-05-04 06:07:56.364555	1	193
126	Screwdrivers Bits(螺丝刀头)	\N	2026-05-04 06:07:56.364555	1	193
127	Socket Sets(套筒组)	\N	2026-05-04 06:07:56.364555	1	193
128	Spanners Wrenchers(扳手)	\N	2026-05-04 06:07:56.364555	1	193
129	Special Automotive Tools(专用汽车工具)	\N	2026-05-04 06:07:56.364555	1	193
130	Tool Box Storage(工具箱收纳)	\N	2026-05-04 06:07:56.364555	1	193
131	Tool Pouches Bags(工具袋)	\N	2026-05-04 06:07:56.364555	1	193
132	Torque Wrenches(扭力扳手)	\N	2026-05-04 06:07:56.364555	1	193
93	Plumber Tools(水管工工具)	\N	2026-05-04 06:07:56.364555	1	193
116	Health Safety Articles(健康安全用品)	\N	2026-05-04 06:07:56.364555	1	193
73	Abrasives(磨料)	\N	2026-05-04 06:07:56.364555	1	194
74	Cup Brush(杯刷)	\N	2026-05-04 06:07:56.364555	1	194
75	Grinding Cutting Disc(磨切割片)	\N	2026-05-04 06:07:56.364555	1	194
77	Marble Saw(大理石锯)	\N	2026-05-04 06:07:56.364555	1	194
78	Metal Band Saw(金属带锯)	\N	2026-05-04 06:07:56.364555	1	194
79	Miter Saw(斜切锯)	\N	2026-05-04 06:07:56.364555	1	194
114	Grinding Tools(研磨工具)	\N	2026-05-04 06:07:56.364555	1	194
85	Agriculture Product(农业产品)	\N	2026-05-04 06:07:56.364555	1	195
170	Electric Sprayer(电动喷雾器)	\N	2026-05-04 06:07:56.364555	1	195
171	Knapsack Sprayer(背负式喷雾器)	\N	2026-05-04 06:07:56.364555	1	195
172	Power Sprayer(动力喷雾器)	\N	2026-05-04 06:07:56.364555	1	195
95	Trimmer Line(修剪机线)	\N	2026-05-04 06:07:56.364555	1	195
94	Spark Plug(火花塞)	\N	2026-05-04 06:07:56.364555	1	195
92	Lubricant Oil(润滑油)	\N	2026-05-04 06:07:56.364555	1	195
134	Bolt And Nuts(螺栓螺母)	\N	2026-05-04 06:07:56.364555	1	196
91	Food Processing Machine(食品加工机)	\N	2026-05-04 06:07:56.364555	1	197
55	Tungsten Carbide Bur(硬质合金旋转锉)	\N	2026-05-04 06:07:56.364555	1	197
56	Needle Scaling Gun(针式除锈枪)	\N	2026-05-04 06:07:56.364555	1	197
57	Scaling Hammer(除锈锤)	\N	2026-05-04 06:07:56.364555	1	197
\.


--
-- Data for Name: delivery_order_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_order_attachments (id, do_id, original_name, storage_path, mime_type, file_size, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: delivery_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_order_items (id, do_id, product_id, item_code, description, serial_no, quantity, sort_order) FROM stdin;
1	1	90	PUD-38	PU DUCT HOSE 1 1/2 * 6 Meter	\N	1.000	0
2	2	92	AT010B	AIKOKI BRUSHLESS CORDLESS IMPACT DRILL SET	\N	1.000	0
3	3	93	WCWM70085	KING MIG WIRE ER70S-6 0.8mm WHITE BOX (5KG)	\N	3.000	0
4	3	95	WCWM7008	KING MIG WIRE ER70S-6 0.8m (15KG)	\N	2.000	1
5	3	96	WCE601325T	TAKADA WELD M/S ELECTRODE 6013/2.5mm 1*20kg	\N	20.000	2
7	4	97	DS-20A-3	BOSSCO AUTO SUB.PUMP 3" 2HP 415V	\N	2.000	0
8	5	98	P86H1	NEOVIN PRESSURE CONTROLLER 1.1KW	\N	6.000	0
9	5	99	PS-3H	NEOVIN PRESSURE SWITCH 3/8" female for P150B2	\N	3.000	1
11	7	101	TNRV030-P090111-030.0	TRANSMAX WORM GEAR SPEED REDUCER	\N	1.000	0
12	6	100	IS1/2D-TT14.5H	IMPACT SOCKET 1/2" 14.5mm TT CRMO(DEEP) H21	\N	5.000	0
13	8	102	DP510312011	TANK WHEEL FOR SV-202(IK) DP510312011	\N	4.000	0
15	9	103	654000108013	SKC HAND TAP M 8*1.25	\N	2.000	0
16	9	104	654000201016	SKC HAND TAP BSW 16* 3/8	\N	1.000	1
17	9	105	010001106008	M10 3/8 DEEP SOCKET 12PT-MM 8*KD	\N	2.000	2
\.


--
-- Data for Name: delivery_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_orders (id, tenant_id, supplier_id, do_no, do_date, notes, created_by, created_at, updated_at, warehouse_id, posted_to_inventory) FROM stdin;
1	1	40	DO-2601073	2026-01-06	\N	2	2026-05-07 00:42:53.141232	2026-05-07 00:42:53.141232	1	t
2	1	52	DO-202601/0016	2026-01-02	\N	2	2026-05-07 00:48:38.008633	2026-05-07 00:48:38.008633	1	t
3	1	67	DO-50415	2026-01-02	\N	2	2026-05-07 00:54:14.685072	2026-05-07 00:54:14.685072	1	t
4	1	55	IN0212425	2026-01-02	\N	2	2026-05-07 04:27:12.956713	2026-05-07 04:28:08.703573	1	t
5	1	55	IN0212353	2026-01-02	\N	2	2026-05-07 04:34:02.098508	2026-05-07 04:34:02.098508	1	t
7	1	45	CO/DO/204785	2026-01-06	\N	2	2026-05-07 09:13:32.223725	2026-05-07 09:13:32.223725	1	t
6	1	39	IV-149460	2026-01-08	\N	2	2026-05-07 07:15:25.729232	2026-05-07 09:15:07.025304	1	t
8	1	36	26601/0216	2026-01-05	\N	2	2026-05-07 09:17:10.599908	2026-05-07 09:17:10.599908	1	t
9	1	58	J02317	2026-01-21	\N	2	2026-05-07 09:19:27.215569	2026-05-07 09:21:40.663515	1	t
\.


--
-- Data for Name: document_prompts; Type: TABLE DATA; Schema: public; Owner: inventory_user
--

COPY public.document_prompts (id, tenant_id, name, content, is_default, created_by, created_at, updated_at) FROM stdin;
1	1	Default DO/Invoice Extractor	You are analyzing a business document (Delivery Order or Invoice).\nExtract these fields and return ONLY a JSON object with this exact structure:\n{\n  "documentType": "delivery_order" or "invoice" or "unknown",\n  "documentNumber": "the reference number like DO-12345 or INV-67890",\n  "date": "YYYY-MM-DD if found",\n  "supplierName": "the company/vendor name",\n  "items": [{"description": "product name", "quantity": number}]\n}\nUse null for missing fields. Output ONLY JSON, no markdown fences.	t	\N	2026-05-06 10:42:27.036821+00	2026-05-06 10:42:27.036821+00
2	1	bhj	gh	f	2	2026-05-06 11:59:40.762526+00	2026-05-06 11:59:40.762526+00
\.


--
-- Data for Name: low_stock_alert_states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.low_stock_alert_states (id, product_id, warehouse_id, status, assigned_to, notes, updated_by, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_connections (id, channel, shop_name, api_base_url, access_token, refresh_token, metadata, is_active, updated_by, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_error_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_error_logs (id, channel, operation, error_code, message, details, request_id, created_by, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_inventory_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_inventory_snapshots (id, channel, external_sku, product_id, warehouse_id, on_hand, allocated_quantity, available_quantity, payload, synced_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_oauth_states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_oauth_states (id, channel, state_token, redirect_uri, expires_at, created_by, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_order_items (id, marketplace_order_id, external_item_id, external_sku, product_id, quantity, unit_price, payload, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_orders (id, channel, external_order_id, order_status, buyer_name, total_amount, currency, order_created_at, payload, synced_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: marketplace_sync_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_sync_logs (id, channel, sync_type, status, records_count, raw_response, synced_by, synced_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: product_bundle_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_bundle_items (id, combo_product_id, item_product_id, item_quantity, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: product_cost_price_histories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_cost_price_histories (id, product_id, old_cost_price, new_cost_price, percent_change, reason, changed_by, changed_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_images (id, product_id, image_data, sort_order, is_primary, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: product_pricing_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_pricing_rules (id, product_id, rule_name, channel_key, markup_percentage, suggested_price, is_default, sort_order, created_at, tenant_id) FROM stdin;
1	90	Retail	retail	0.00	0.00	t	0	2026-05-07 00:42:48.720369	1
2	91	Retail	retail	0.00	0.00	t	0	2026-05-07 00:46:27.866989	1
3	92	Retail	retail	0.00	0.00	t	0	2026-05-07 00:48:34.744682	1
4	93	Retail	retail	0.00	0.00	t	0	2026-05-07 00:51:49.695198	1
5	95	Retail	retail	0.00	0.00	t	0	2026-05-07 00:52:53.932099	1
6	96	Retail	retail	0.00	0.00	t	0	2026-05-07 00:54:10.272451	1
7	97	Retail	retail	0.00	0.00	t	0	2026-05-07 04:26:59.954058	1
8	98	Retail	retail	0.00	0.00	t	0	2026-05-07 04:32:33.858647	1
9	99	Retail	retail	0.00	0.00	t	0	2026-05-07 04:33:55.485561	1
10	100	Retail	retail	0.00	0.00	t	0	2026-05-07 07:15:19.674445	1
11	101	Retail	retail	0.00	0.00	t	0	2026-05-07 09:13:28.998692	1
12	102	Retail	retail	0.00	0.00	t	0	2026-05-07 09:17:06.832296	1
13	103	Retail	retail	0.00	0.00	t	0	2026-05-07 09:19:21.300469	1
14	104	Retail	retail	0.00	0.00	t	0	2026-05-07 09:20:44.18862	1
15	105	Retail	retail	0.00	0.00	t	0	2026-05-07 09:21:35.943314	1
\.


--
-- Data for Name: product_suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_suppliers (id, product_id, supplier_id, is_primary, created_by, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, sku, sku_type, product_code, barcode, image_data, description, usage_guide, pros, cons, category_id, unit, cost_price, selling_price, markup_percentage, suggested_price, reorder_level, is_active, created_at, updated_at, tenant_id, brand_id) FROM stdin;
1	Carpet Cleaner	A-SKU-00001	EA	A-PRD-00001	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	1	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	1
2	Gasoline Engine	A-SKU-00002	EA	A-PRD-00002	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	2	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	1
3	Carpet Cleaner	A-SKU-00003	EA	A-PRD-00003	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	1	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	2
4	Floor Dryer C/W Handle	A-SKU-00004	EA	A-PRD-00004	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	3	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	2
5	High Pressure Washer	A-SKU-00005	EA	A-PRD-00005	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	4	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	2
6	Vacuum	A-SKU-00006	EA	A-PRD-00006	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	5	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	2
7	Air Compressor	A-SKU-00007	EA	A-PRD-00007	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	6	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
8	Airless Paint Sprayer	A-SKU-00008	EA	A-PRD-00008	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	7	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
9	Diesel Engine	A-SKU-00009	EA	A-PRD-00009	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	8	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
10	Diesel Generator	A-SKU-00010	EA	A-PRD-00010	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	9	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
11	Diesel Tower Light	A-SKU-00011	EA	A-PRD-00011	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	10	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
12	Diesel Water Pump	A-SKU-00012	EA	A-PRD-00012	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	11	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
13	Diesel Welding Generator	A-SKU-00013	EA	A-PRD-00013	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	12	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
14	Floor Polisher	A-SKU-00014	EA	A-PRD-00014	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	13	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
15	Gasoline Engine	A-SKU-00015	EA	A-PRD-00015	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	2	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
16	Gasoline Generator	A-SKU-00016	EA	A-PRD-00016	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	14	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
17	Gasoline Water Pump	A-SKU-00017	EA	A-PRD-00017	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	15	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
18	Gasoline Welding Generator	A-SKU-00018	EA	A-PRD-00018	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	16	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
19	High Pressure Washer	A-SKU-00019	EA	A-PRD-00019	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	4	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
20	Pallet Truck	A-SKU-00020	EA	A-PRD-00020	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	99	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
21	Plunger Pump Head	A-SKU-00021	EA	A-PRD-00021	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	17	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
22	Plunger Pump Set	A-SKU-00022	EA	A-PRD-00022	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	17	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
23	Snow Wash Tank	A-SKU-00023	EA	A-PRD-00023	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	18	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	3
24	Air Compressor	A-SKU-00024	EA	A-PRD-00024	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	6	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	4
25	Air Compressor	A-SKU-00025	EA	A-PRD-00025	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	6	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	5
26	Gasoline Engine	A-SKU-00026	EA	A-PRD-00026	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	2	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	5
27	Gasoline Generator	A-SKU-00027	EA	A-PRD-00027	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	14	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	5
28	Gasoline High Pressure Washer	A-SKU-00028	EA	A-PRD-00028	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	4	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	5
29	Gasoline Inverter Generator	A-SKU-00029	EA	A-PRD-00029	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	14	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	5
30	Gasoline Water Pump	A-SKU-00030	EA	A-PRD-00030	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	15	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	5
31	Gasoline Inverter Generator	A-SKU-00031	EA	A-PRD-00031	\N	\N	Supplier: APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	14	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	6
32	Bar Cutter	A-SKU-00032	EA	A-PRD-00032	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	19	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
33	Diamond Blade	A-SKU-00033	EA	A-PRD-00033	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	20	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
34	Self Priming Pump	A-SKU-00034	EA	A-PRD-00034	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	21	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
35	HP Series Submersible Pump	A-SKU-00035	EA	A-PRD-00035	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	22	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
36	Bar Bender	A-SKU-00036	EA	A-PRD-00036	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	23	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
37	Concrete Mixer	A-SKU-00037	EA	A-PRD-00037	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	24	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
38	Mini Mixer	A-SKU-00038	EA	A-PRD-00038	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	25	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
39	Generator	A-SKU-00039	EA	A-PRD-00039	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	26	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
40	Welding Machine	A-SKU-00040	EA	A-PRD-00040	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	27	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
41	Power Cut Machine	A-SKU-00041	EA	A-PRD-00041	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	28	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
42	JHI Series Submersible Pump	A-SKU-00042	EA	A-PRD-00042	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	22	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
43	JHI Series Concrete Vibrator	A-SKU-00043	EA	A-PRD-00043	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	29	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
44	HK Series Concrete Vibrator	A-SKU-00044	EA	A-PRD-00044	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	29	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
45	Power Trowel	A-SKU-00045	EA	A-PRD-00045	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	30	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
46	Drilling Hydraulic	A-SKU-00046	EA	A-PRD-00046	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	31	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
47	Machine Breaker	A-SKU-00047	EA	A-PRD-00047	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	32	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
48	Road Cutter	A-SKU-00048	EA	A-PRD-00048	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	33	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
49	Tamping Rammer	A-SKU-00049	EA	A-PRD-00049	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	34	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
50	Plate Compactor	A-SKU-00050	EA	A-PRD-00050	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	35	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
51	Floor Scarifier	A-SKU-00051	EA	A-PRD-00051	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	36	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
52	Tower Light	A-SKU-00052	EA	A-PRD-00052	\N	\N	Supplier: JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	37	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	7
53	Concrete Breaker TPB-30,40,60,73,90	A-SKU-00053	EA	A-PRD-00053	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	38	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
54	Pick Hammer TCA-7	A-SKU-00054	EA	A-PRD-00054	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	39	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
55	Rock Drill TH-5S	A-SKU-00055	EA	A-PRD-00055	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	40	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
56	Chipping Hammer AA-OB	A-SKU-00056	EA	A-PRD-00056	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	41	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
57	Chain Hoist 0.5-80 ton	A-SKU-00057	EA	A-PRD-00057	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	42	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
58	Baby Hammer MH-5111	A-SKU-00058	EA	A-PRD-00058	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	43	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
59	Air Drill MD-3311B	A-SKU-00059	EA	A-PRD-00059	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	44	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
60	Air Winch	A-SKU-00060	EA	A-PRD-00060	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	45	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
61	3/4 Impact Wrench MI-2500P	A-SKU-00061	EA	A-PRD-00061	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	46	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
62	Air Tamper TB-00G	A-SKU-00062	EA	A-PRD-00062	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	47	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
63	Angle Grinder TSG-3C	A-SKU-00063	EA	A-PRD-00063	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	48	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
64	Rotary Grinder	A-SKU-00064	EA	A-PRD-00064	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	49	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
65	1 Impact Wrench MI-5000GL	A-SKU-00065	EA	A-PRD-00065	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	46	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	8
66	Spray Gun K-600S	A-SKU-00066	EA	A-PRD-00066	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	50	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	9
67	Air Nailer F-30	A-SKU-00067	EA	A-PRD-00067	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	51	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	9
68	Industrial Sander AS-6602	A-SKU-00068	EA	A-PRD-00068	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	52	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	9
69	CT-1516 Air Body Saw	A-SKU-00069	EA	A-PRD-00069	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	53	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	9
70	O Professional Air Flux Chipper/Scaler CS-2270	A-SKU-00070	EA	A-PRD-00070	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	54	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	9
71	TUNGSTEN CARBIDE BUR	A-SKU-00071	EA	A-PRD-00071	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	55	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	10
72	Needle Scaling Gun VL-303	A-SKU-00072	EA	A-PRD-00072	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	56	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	11
73	Scaling Hammer VL SH-1H	A-SKU-00073	EA	A-PRD-00073	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	57	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	11
74	Scaling Hammer SH-3H	A-SKU-00074	EA	A-PRD-00074	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	57	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	11
75	Water Pump	A-SKU-00075	EA	A-PRD-00075	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	58	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	12
76	Booster Pump	A-SKU-00076	EA	A-PRD-00076	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	59	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	13
77	Auto Booster	A-SKU-00077	EA	A-PRD-00077	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	142	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	14
78	Electronic Flow-Control	A-SKU-00078	EA	A-PRD-00078	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	66	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	14
79	Large Mix Flow	A-SKU-00079	EA	A-PRD-00079	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	58	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	14
80	DSP Submersible Sewage Pump	A-SKU-00080	EA	A-PRD-00080	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	146	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	14
81	Booster Pump	A-SKU-00081	EA	A-PRD-00081	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	59	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	14
82	Under Water Light	A-SKU-00082	EA	A-PRD-00082	\N	\N	Supplier: Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	69	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	14
83	Bearing	A-SKU-00083	EA	A-PRD-00083	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	133	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
84	Bolt And Nuts	A-SKU-00084	EA	A-PRD-00084	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	134	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
85	Couplings	A-SKU-00085	EA	A-PRD-00085	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	135	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
86	Industrial Power Transmission Belts	A-SKU-00086	EA	A-PRD-00086	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	136	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
87	Pulley	A-SKU-00087	EA	A-PRD-00087	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	137	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
88	Gear & Grease Gun	A-SKU-00088	EA	A-PRD-00088	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	138	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
89	Roller Chain & Sprocket	A-SKU-00089	EA	A-PRD-00089	\N	\N	Supplier: Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	139	EA	0.00	0.00	0.00	0.00	0	t	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	1	28
90	PU DUCT HOSE 1 1/2 * 6 Meter	SKU-090	SINGLE	PUD-38	\N	\N	\N	\N	\N	\N	\N	LIGHTS	0.00	0.00	0.00	0.00	0	t	2026-05-07 00:42:48.704529	2026-05-07 00:42:48.704529	1	\N
91	DUST HOSE 1-1/4" * 6 Meter	SKY-0091	SINGLE	PUD-32	\N	\N	\N	\N	\N	\N	\N	LGTHS	0.00	0.00	0.00	0.00	0	t	2026-05-07 00:46:27.853782	2026-05-07 00:46:27.853782	1	\N
92	AIKOKI BRUSHLESS CORDLESS IMPACT DRILL SET	SKU-100	SINGLE	AT010B	\N	\N	\N	\N	\N	\N	\N	UNIT	0.00	0.00	0.00	0.00	0	t	2026-05-07 00:48:34.730501	2026-05-07 00:48:34.730501	1	\N
93	KING MIG WIRE ER70S-6 0.8mm WHITE BOX (5KG)	SKU-102	SINGLE	WCWM70085	\N	\N	\N	\N	\N	\N	\N	ROLL	0.00	0.00	0.00	0.00	0	t	2026-05-07 00:51:49.681839	2026-05-07 00:51:49.681839	1	\N
95	KING MIG WIRE ER70S-6 0.8m (15KG)	SKU-103	SINGLE	WCWM7008	\N	\N	\N	\N	\N	\N	\N	ROLL	0.00	0.00	0.00	0.00	0	t	2026-05-07 00:52:53.919441	2026-05-07 00:52:53.919441	1	\N
96	TAKADA WELD M/S ELECTRODE 6013/2.5mm 1*20kg	SKU-104	SINGLE	WCE601325T	\N	\N	\N	\N	\N	\N	\N	KG	0.00	0.00	0.00	0.00	0	t	2026-05-07 00:54:10.261204	2026-05-07 00:54:10.261204	1	\N
97	BOSSCO AUTO SUB.PUMP 3" 2HP 415V	SKU-P001	SINGLE	DS-20A-3	\N	\N	\N	\N	\N	\N	\N	UNIT	0.00	0.00	0.00	0.00	0	t	2026-05-07 04:26:59.935396	2026-05-07 04:26:59.935396	1	13
98	NEOVIN PRESSURE CONTROLLER 1.1KW	SKU-P002	SINGLE	P86H1	\N	\N	6 UNIT S/NO: 25.P86B2332984, 25.P86B2332988, 25.P86B2332985, 25.P86B2332980, 25.P86B2332983, 25.P86B2332987	\N	\N	\N	\N	UNIT	0.00	0.00	0.00	0.00	0	t	2026-05-07 04:32:33.840535	2026-05-07 04:32:33.840535	1	\N
99	NEOVIN PRESSURE SWITCH 3/8" female for P150B2	SKU-P003	SINGLE	PS-3H	\N	\N	\N	\N	\N	\N	\N	UNIT	0.00	0.00	0.00	0.00	0	t	2026-05-07 04:33:55.466882	2026-05-07 04:33:55.466882	1	\N
100	IMPACT SOCKET 1/2" 14.5mm TT CRMO(DEEP) H21	SKU-TT001	SINGLE	IS1/2D-TT14.5H	\N	\N	\N	\N	\N	\N	\N	pcs	0.00	0.00	0.00	0.00	0	t	2026-05-07 07:15:19.645858	2026-05-07 07:15:19.645858	1	\N
101	TRANSMAX WORM GEAR SPEED REDUCER	SKU-SR001	SINGLE	TNRV030-P090111-030.0	\N	\N	\N	\N	\N	\N	\N	pcs	0.00	0.00	0.00	0.00	0	t	2026-05-07 09:13:28.980354	2026-05-07 09:13:28.980354	1	\N
102	TANK WHEEL FOR SV-202(IK) DP510312011	SKU-TW001	SINGLE	DP510312011	\N	\N	\N	\N	\N	\N	\N	pcs	0.00	0.00	0.00	0.00	0	t	2026-05-07 09:17:06.812458	2026-05-07 09:17:06.812458	1	\N
103	SKC HAND TAP M 8*1.25	SKU-HT001	SINGLE	654000108013	\N	\N	\N	\N	\N	\N	\N	pcs	0.00	0.00	0.00	0.00	0	t	2026-05-07 09:19:21.281757	2026-05-07 09:19:21.281757	1	\N
104	SKC HAND TAP BSW 16* 3/8	SKU-HT002	SINGLE	654000201016	\N	\N	\N	\N	\N	\N	\N	SET	0.00	0.00	0.00	0.00	0	t	2026-05-07 09:20:44.170706	2026-05-07 09:20:44.170706	1	\N
105	M10 3/8 DEEP SOCKET 12PT-MM 8*KD	SKU-DS001	SINGLE	010001106008	\N	\N	\N	\N	\N	\N	\N	pcs	0.00	0.00	0.00	0.00	0	t	2026-05-07 09:21:35.923396	2026-05-07 09:21:35.923396	1	\N
\.


--
-- Data for Name: shipping_shipments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipping_shipments (id, channel, marketplace_order_id, shipment_status, carrier, service_level, tracking_no, label_url, shipped_at, delivered_at, payload, updated_by, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: stock_count_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_count_items (id, stock_count_id, product_id, warehouse_id, expected_quantity, counted_quantity, difference_quantity, notes, tenant_id) FROM stdin;
1	1	90	1	1	1	0	\N	1
2	1	92	1	1	1	0	\N	1
3	1	93	1	3	3	0	\N	1
4	1	95	1	2	2	0	\N	1
5	1	96	1	20	20	0	\N	1
6	1	97	1	2	2	0	\N	1
7	1	98	1	6	6	0	\N	1
8	1	99	1	3	3	0	\N	1
9	1	100	1	5	5	0	\N	1
10	1	101	1	1	1	0	\N	1
11	1	102	1	4	4	0	\N	1
12	1	103	1	2	2	0	\N	1
13	1	104	1	1	1	0	\N	1
14	1	105	1	2	2	0	\N	1
\.


--
-- Data for Name: stock_counts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_counts (id, warehouse_id, status, notes, created_by, completed_by, applied_by, created_at, completed_at, applied_at, tenant_id) FROM stdin;
1	1	OPEN	\N	2	\N	\N	2026-05-07 11:34:32.938182	\N	\N	1
\.


--
-- Data for Name: stock_levels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_levels (id, product_id, warehouse_id, quantity, allocated_quantity, updated_at, tenant_id) FROM stdin;
1	90	1	1	0	2026-05-07 00:42:53.141232	1
2	92	1	1	0	2026-05-07 00:48:38.008633	1
3	93	1	3	0	2026-05-07 00:54:14.685072	1
4	95	1	2	0	2026-05-07 00:54:14.685072	1
5	96	1	20	0	2026-05-07 00:54:14.685072	1
6	97	1	2	0	2026-05-07 04:28:08.703573	1
9	98	1	6	0	2026-05-07 04:34:02.098508	1
10	99	1	3	0	2026-05-07 04:34:02.098508	1
12	101	1	1	0	2026-05-07 09:13:32.223725	1
11	100	1	5	0	2026-05-07 09:15:07.025304	1
15	102	1	4	0	2026-05-07 09:17:10.599908	1
16	103	1	2	0	2026-05-07 09:21:40.663515	1
19	104	1	1	0	2026-05-07 09:21:40.663515	1
20	105	1	2	0	2026-05-07 09:21:40.663515	1
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, movement_type, product_id, source_warehouse_id, destination_warehouse_id, quantity, reference_no, notes, created_by, created_at, supplier_id, unit_cost, purchase_reason, tenant_id) FROM stdin;
1	IN	90	\N	1	1	DO-DO-2601073	Delivery Order DO-2601073	2	2026-05-07 00:42:53.141232	40	\N	\N	1
2	IN	92	\N	1	1	DO-DO-202601/0016	Delivery Order DO-202601/0016	2	2026-05-07 00:48:38.008633	52	\N	\N	1
3	IN	93	\N	1	3	DO-DO-50415	Delivery Order DO-50415	2	2026-05-07 00:54:14.685072	67	\N	\N	1
4	IN	95	\N	1	2	DO-DO-50415	Delivery Order DO-50415	2	2026-05-07 00:54:14.685072	67	\N	\N	1
5	IN	96	\N	1	20	DO-DO-50415	Delivery Order DO-50415	2	2026-05-07 00:54:14.685072	67	\N	\N	1
6	IN	97	\N	1	2	DO-IN0212425	Delivery Order IN0212425	2	2026-05-07 04:27:12.956713	55	\N	\N	1
7	OUT	97	1	\N	2	DO-IN0212425-REVERT	Revert delivery order IN0212425 before update	2	2026-05-07 04:28:08.703573	55	\N	\N	1
8	IN	97	\N	1	2	DO-IN0212425	Delivery Order IN0212425 (updated)	2	2026-05-07 04:28:08.703573	55	\N	\N	1
9	IN	98	\N	1	6	DO-IN0212353	Delivery Order IN0212353	2	2026-05-07 04:34:02.098508	55	\N	\N	1
10	IN	99	\N	1	3	DO-IN0212353	Delivery Order IN0212353	2	2026-05-07 04:34:02.098508	55	\N	\N	1
11	IN	100	\N	1	5	DO-IV-149460	Delivery Order IV-149460	2	2026-05-07 07:15:25.729232	39	\N	\N	1
12	IN	101	\N	1	1	DO-CO/DO/204785	Delivery Order CO/DO/204785	2	2026-05-07 09:13:32.223725	45	\N	\N	1
13	OUT	100	1	\N	5	DO-IV-149460-REVERT	Revert delivery order IV-149460 before update	2	2026-05-07 09:15:07.025304	39	\N	\N	1
14	IN	100	\N	1	5	DO-IV-149460	Delivery Order IV-149460 (updated)	2	2026-05-07 09:15:07.025304	39	\N	\N	1
15	IN	102	\N	1	4	DO-26601/0216	Delivery Order 26601/0216	2	2026-05-07 09:17:10.599908	36	\N	\N	1
16	IN	103	\N	1	2	DO-J02317	Delivery Order J02317	2	2026-05-07 09:19:27.215569	58	\N	\N	1
17	OUT	103	1	\N	2	DO-J02317-REVERT	Revert delivery order J02317 before update	2	2026-05-07 09:21:40.663515	58	\N	\N	1
18	IN	103	\N	1	2	DO-J02317	Delivery Order J02317 (updated)	2	2026-05-07 09:21:40.663515	58	\N	\N	1
19	IN	104	\N	1	1	DO-J02317	Delivery Order J02317 (updated)	2	2026-05-07 09:21:40.663515	58	\N	\N	1
20	IN	105	\N	1	2	DO-J02317	Delivery Order J02317 (updated)	2	2026-05-07 09:21:40.663515	58	\N	\N	1
\.


--
-- Data for Name: supplier_brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_brands (supplier_id, brand_id, tenant_id, created_at) FROM stdin;
34	1	1	2026-05-04 06:07:56.364555+00
34	2	1	2026-05-04 06:07:56.364555+00
34	3	1	2026-05-04 06:07:56.364555+00
34	4	1	2026-05-04 06:07:56.364555+00
34	5	1	2026-05-04 06:07:56.364555+00
34	6	1	2026-05-04 06:07:56.364555+00
35	7	1	2026-05-04 06:07:56.364555+00
36	8	1	2026-05-04 06:07:56.364555+00
36	9	1	2026-05-04 06:07:56.364555+00
36	10	1	2026-05-04 06:07:56.364555+00
36	11	1	2026-05-04 06:07:56.364555+00
36	12	1	2026-05-04 06:07:56.364555+00
36	13	1	2026-05-04 06:07:56.364555+00
36	14	1	2026-05-04 06:07:56.364555+00
37	15	1	2026-05-04 06:07:56.364555+00
37	16	1	2026-05-04 06:07:56.364555+00
37	17	1	2026-05-04 06:07:56.364555+00
37	18	1	2026-05-04 06:07:56.364555+00
37	19	1	2026-05-04 06:07:56.364555+00
37	20	1	2026-05-04 06:07:56.364555+00
37	21	1	2026-05-04 06:07:56.364555+00
37	22	1	2026-05-04 06:07:56.364555+00
37	23	1	2026-05-04 06:07:56.364555+00
44	24	1	2026-05-04 06:07:56.364555+00
44	25	1	2026-05-04 06:07:56.364555+00
44	26	1	2026-05-04 06:07:56.364555+00
44	27	1	2026-05-04 06:07:56.364555+00
59	28	1	2026-05-04 06:07:56.364555+00
60	29	1	2026-05-04 06:07:56.364555+00
60	30	1	2026-05-04 06:07:56.364555+00
60	31	1	2026-05-04 06:07:56.364555+00
60	32	1	2026-05-04 06:07:56.364555+00
60	33	1	2026-05-04 06:07:56.364555+00
60	34	1	2026-05-04 06:07:56.364555+00
60	35	1	2026-05-04 06:07:56.364555+00
60	36	1	2026-05-04 06:07:56.364555+00
60	37	1	2026-05-04 06:07:56.364555+00
60	38	1	2026-05-04 06:07:56.364555+00
60	39	1	2026-05-04 06:07:56.364555+00
50	40	1	2026-05-04 11:34:20.816103+00
50	41	1	2026-05-04 11:34:20.816103+00
50	42	1	2026-05-04 11:34:20.816103+00
50	43	1	2026-05-04 11:34:20.816103+00
50	44	1	2026-05-04 11:34:20.816103+00
50	45	1	2026-05-04 11:34:20.816103+00
50	46	1	2026-05-04 11:34:20.816103+00
50	47	1	2026-05-04 11:34:20.816103+00
50	48	1	2026-05-04 11:34:20.820505+00
50	49	1	2026-05-04 11:34:20.820505+00
50	50	1	2026-05-04 11:34:20.821251+00
50	51	1	2026-05-04 11:34:20.821251+00
50	52	1	2026-05-04 11:34:20.821893+00
50	61	1	2026-05-04 11:34:20.822328+00
50	53	1	2026-05-04 11:34:20.822845+00
50	54	1	2026-05-04 11:34:20.822845+00
50	55	1	2026-05-04 11:34:20.823196+00
50	56	1	2026-05-04 11:34:20.823196+00
50	57	1	2026-05-04 11:34:20.823196+00
50	58	1	2026-05-04 11:34:20.823196+00
50	59	1	2026-05-04 11:34:20.823196+00
50	60	1	2026-05-04 11:34:20.823687+00
\.


--
-- Data for Name: supplier_invoice_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_invoice_attachments (id, invoice_id, original_name, storage_path, mime_type, file_size, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: supplier_invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_invoice_items (id, invoice_id, product_id, item_code, description, serial_no, quantity, unit_price, discount, amount, sort_order) FROM stdin;
2	1	90	PUD-38	PU DUCT HOSE 1 1/2 * 6 Meter	\N	1.000	250.00	0.00	250.00	0
3	2	92	AT010B	AIKOKI BRUSHLESS CORDLESS IMPACT DRILL SET	\N	2.000	130.00	0.00	260.00	0
4	3	93	WCWM70085	KING MIG WIRE ER70S-6 0.8mm WHITE BOX (5KG)	\N	3.000	32.00	0.00	96.00	0
5	3	95	WCWM7008	KING MIG WIRE ER70S-6 0.8m (15KG)	\N	2.000	72.00	0.00	144.00	1
6	3	96	WCE601325T	TAKADA WELD M/S ELECTRODE 6013/2.5mm 1*20kg	\N	20.000	6.00	0.00	120.00	2
7	4	97	DS-20A-3	BOSSCO AUTO SUB.PUMP 3" 2HP 415V	\N	2.000	1500.00	0.00	3000.00	0
8	5	98	P86H1	NEOVIN PRESSURE CONTROLLER 1.1KW	\N	6.000	75.00	0.00	450.00	0
9	5	99	PS-3H	NEOVIN PRESSURE SWITCH 3/8" female for P150B2	\N	3.000	10.00	0.00	30.00	1
10	6	100	IS1/2D-TT14.5H	IMPACT SOCKET 1/2" 14.5mm TT CRMO(DEEP) H21	\N	5.000	10.50	0.00	52.50	0
11	7	101	TNRV030-P090111-030.0	TRANSMAX WORM GEAR SPEED REDUCER	\N	1.000	165.00	0.00	165.00	0
12	8	103	654000108013	SKC HAND TAP M 8*1.25	\N	2.000	27.20	30.00	24.40	0
13	8	104	654000201016	SKC HAND TAP BSW 16* 3/8	\N	1.000	33.60	30.00	3.60	1
14	8	105	010001106008	M10 3/8 DEEP SOCKET 12PT-MM 8*KD	\N	2.000	14.00	25.00	3.00	2
\.


--
-- Data for Name: supplier_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_invoices (id, tenant_id, supplier_id, do_id, invoice_no, invoice_date, total_amount, total_quantity, notes, created_by, created_at, updated_at, warehouse_id, posted_to_inventory) FROM stdin;
1	1	40	1	IV-2601073	2026-05-06	250.00	1.000	\N	2	2026-05-07 00:44:12.959339	2026-05-07 00:44:28.915753	\N	f
2	1	52	2	I-202601/0016	2026-01-02	260.00	2.000	\N	2	2026-05-07 00:49:12.430246	2026-05-07 00:49:12.430246	\N	f
3	1	67	3	IV-49272	2026-01-02	360.00	25.000	\N	2	2026-05-07 00:55:04.505645	2026-05-07 00:55:04.505645	\N	f
4	1	55	4	IN0212425	2026-01-02	3000.00	2.000	\N	2	2026-05-07 04:27:48.031097	2026-05-07 04:27:48.031097	\N	f
5	1	55	5	IN0212353	2026-01-02	480.00	9.000	\N	2	2026-05-07 04:37:08.907411	2026-05-07 04:37:08.907411	\N	f
6	1	39	6	IV-149460	2026-05-07	52.50	5.000	\N	2	2026-05-07 09:03:23.794648	2026-05-07 09:03:23.794648	\N	f
7	1	45	7	CO/IN/251955	2026-01-06	165.00	1.000	\N	2	2026-05-07 09:14:09.553588	2026-05-07 09:14:09.553588	\N	f
8	1	58	9	J02317	2026-01-22	31.00	5.000	\N	2	2026-05-07 09:23:00.073902	2026-05-07 09:23:00.073902	\N	f
\.


--
-- Data for Name: supplier_payment_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_payment_records (id, supplier_id, period_month, period_year, paid_date, amount, notes, created_by, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: supplier_payment_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_payment_schedules (id, tenant_id, supplier_id, period_month, period_year, due_date, amount_due, amount_paid, status, remind_days_before, reminder_sent, overdue_reminded_date, notes, created_by, created_at, updated_at, monthly_reminded_month) FROM stdin;
3	1	37	7	2026	2026-07-15	3000.00	0.00	PENDING	3	f	\N	\N	2	2026-05-08 08:55:01.35732	2026-05-08 08:55:01.35732	\N
4	1	37	10	2026	2026-10-15	3000.00	0.00	PENDING	3	f	\N	\N	2	2026-05-08 08:55:01.358372	2026-05-08 08:55:01.358372	\N
1	1	37	1	2026	2026-01-15	3000.00	0.00	OVERDUE	3	f	2026-05-08	\N	2	2026-05-08 08:55:01.34794	2026-05-08 08:59:22.29065	\N
2	1	37	4	2026	2026-04-15	3000.00	0.00	OVERDUE	3	f	2026-05-08	\N	2	2026-05-08 08:55:01.355613	2026-05-08 08:59:22.292015	\N
\.


--
-- Data for Name: supplier_return_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_return_attachments (id, return_id, original_name, storage_path, mime_type, file_size, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: supplier_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_return_items (id, return_id, product_id, item_code, description, serial_no, quantity, sort_order) FROM stdin;
1	1	91	PUD-32	DUST HOSE 1-1/4" * 6 Meter	\N	1.000	0
\.


--
-- Data for Name: supplier_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_returns (id, tenant_id, supplier_id, doc_type, document_no, document_date, notes, created_by, created_at, updated_at) FROM stdin;
1	1	40	RETURN	INV-2512170	2026-01-06	\N	2	2026-05-07 00:46:38.35847	2026-05-07 00:46:38.35847
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, name, company_name, contact_name, phone, email, address, payment_terms, lead_time_days, notes, is_active, created_by, updated_by, created_at, updated_at, branch, business_hours, parent_company, map_link, tenant_id) FROM stdin;
34	APE INDUSTRIAL SUPPLIES SDN BHD	\N	\N	\N	\N	No.3, Lot 2-2, Jalan SU 6a, Seksyen 22, 40300 Shah Alam, Selangor	\N	0	Phone: 03-5636 7429	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
35	JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)	\N	\N	\N	\N	Lot 8, 9 & 10, Jalan Emas SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Federal Territory of Kuala Lumpur	\N	0	Phone: 03-6273 1279	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
36	Ikhua Hardware & Machinery Sdn Bhd	\N	\N	\N	\N	Plot F Lot 1998 Jalan Perusahaan 3 Taman Perindustrian Selesa Jaya, Balakong, 43300 Seri Kembangan, Selangor	\N	0	Phone: 03-8961 6855	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
37	JET MACHINERY SDN BHD	\N	\N	\N	\N	\N	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
38	JC MACHINERY SDN BHD	\N	\N	\N	\N	Jalan Kapar, Batu 4, 42100 Klang, Selangor	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
39	Tuta Tools (M) Sdn Bhd	\N	\N	\N	\N	PAGAR HIJAU - CORNER, 2, Jalan USJ 19/4a, Usj 19, 47620 Subang Jaya, Selangor	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
40	TECOLINE SDN BHD	\N	\N	\N	\N	2, Jalan Utama 1/10, Taman Perindustrian Puchong Utama, 47100 Puchong, Selangor	\N	0	Phone: 03-8063 2889	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
41	GERENCO SDN BHD	\N	\N	\N	\N	7, Jalan 3/91A, Taman Shamelin Perkasa, 56100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur	\N	0	Phone: 03-9281 3220	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
42	Hero Industrial Supply Sdn Bhd	\N	\N	\N	\N	62, Jalan Utama 2/16, Taman Perindustrian Maju Jaya, 47140 Puchong, Selangor	\N	0	Phone: 03-8062 5527	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
43	RNS Machinery Sdn Bhd	\N	\N	\N	\N	23, Jalan Balakong Jaya 3 Taman Industri Balakong Jaya Balakong, 43300 Seri Kembangan, Selangor	\N	0	Phone: 019-224 0675	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
44	UNITED POWER MLC S/B	\N	\N	\N	\N	\N	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
45	TEM ENGINEERING GROUP S/B	\N	\N	\N	\N	8, Jalan TPP 6/7, Taman Perindustrian Puchong, 47100 Puchong, Selangor	\N	0	Phone: 03-8062 4233	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
46	Wai Chun Hardware (M) Sdn Bhd	\N	\N	\N	\N	B5-G & 1 & 2, Jalan Rawang, PUSAT PERNIAGAAN REEF 2, 48000 Rawang, Selangor	\N	0	Phone: 010-220 9510	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
47	DENG FUNG MACHINERY sdn bhd	\N	\N	\N	\N	605, Batu 3 3/4, Jalan Ipoh, 51200 Kuala Lumpur	\N	0	Phone: 03 6258 5036 / 012-8927288	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
48	Colson Machinery Sdn. Bhd.	\N	\N	\N	\N	15, Jalan PJS 1/26, Taman Petaling Utama, 46150 Petaling Jaya, Selangor	\N	0	Phone: 03-7783 3199	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
49	Tools & Machinery Parts Supplies Sdn Bhd (TOMAC)	\N	\N	\N	\N	\N	\N	0	Phone: 03-79313381	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
50	Iklim Hardware & Machinery Sdn. Bhd.	\N	\N	\N	\N	23, Jalan 8/91, Taman Shamelin Perkasa, 56100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur	\N	0	Phone: 03-9284 8333	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
51	Tackly Hardware & Machinery Sdn Bhd (德利机械五金有限公司)	\N	\N	\N	\N	No.12, Jalan Metro Perdana Barat 11, Seri Edaran Light Industrial Park, 52100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur	\N	0	Phone: 03-6258 5866	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
52	ASB HARDWARE SDN BHD	\N	\N	\N	\N	221, Jalan Mahkota, Maluri, 55100 Cheras, Wilayah Persekutuan Kuala Lumpur	\N	0	Phone: 010-559 2506	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
53	SIN YUAN MACHINERY SDN BHD	\N	\N	\N	\N	Lot 10, Jalan Emas SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur	\N	0	Phone: 03-6276 6226	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
54	sym equipment sdn bhd	\N	\N	\N	\N	Lot 9, Jalan SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Selangor	\N	0	Phone: 03-6275 1492	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
55	Sym Power Sdn Bhd	\N	\N	\N	\N	Lot 8 & 9, Jalan Emas SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Malaysia	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
56	VA ASIA MOTOR TOOLS HARDWARE TRADING	\N	\N	\N	\N	9, Jalan Bpu 2, Kawasan Perniagaan Bandar Puchong Utama, 47100 Puchong, Selangor	\N	0	Phone: 012-351 1605	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
57	YIE HONG TRADING SDN BHD	\N	\N	\N	\N	37, jalan 8/152, off, batu 6, Taman Perindustrian Oug, 58200 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur	\N	0	Phone: 03-7772 7816	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
58	GLOBALL HARDWARE & MACHINERY S/B (寰球五金机械有限公司)	\N	\N	\N	\N	22G, Jalan Bandar Tiga, Pusat Bandar Puchong, 47100 Puchong, Selangor	\N	0	Phone: 03-8082 0606	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
59	Bangkok Belt & Industry Centre Sdn Bhd	\N	\N	\N	\N	45A & 46A, Jalan TK 1/11a, Taman Kinrara, 47180 Puchong, Selangor	\N	0	Phone: 03-8075 7210	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
60	Chye Khiang Seng (M) Sdn Bhd	\N	\N	\N	\N	WISMA CKS, NO 155, Jalan Kapar, PO BOX 211, 41720, 155, Jalan Kapar, Kawasan 18, 41300 Klang, Selangor	\N	0	Phone: 03-3341 3233	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
61	SHAKO Automation & Trading Sdn Bhd	\N	\N	\N	\N	37, Jalan Utama 1/1, Taman Perindustrian Puchong Utama, 47100 Puchong, Selangor	\N	0	Phone: 03-8062 4241	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
62	ZIM SONG ENTERPRISE	\N	\N	\N	\N	\N	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
63	JAYA POLIGON sdn bhd	\N	\N	\N	\N	13, Jalan Bestari 1/KU7, 42200 Kapar, Selangor	\N	0	Phone: 03-3291 8885	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
64	NOVITECH sdn bhd	\N	\N	\N	\N	1st floor, 182b, 1, Jalan Pasar, Kawasan 18, 41400 Klang, Selangor	\N	0	Phone: 03-3343 9551	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
65	KINIKI MARKETING	\N	\N	\N	\N	27, Jalan Kuchai Lama, Taman Lian Hoe, 58200 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur	\N	0	\N	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
66	GWM marketing sdn bhd	\N	\N	\N	\N	43500 Semenyih, Selangor	\N	0	Phone: 03-8727 8930	t	\N	\N	2026-05-04 06:07:56.364555	2026-05-04 06:07:56.364555	\N	\N	\N	\N	1
67	HELIMAC SDN BHD	HELIMAC SDN BHD	\N	\N	\N	\N	\N	0	\N	t	2	2	2026-05-07 00:49:56.609746	2026-05-07 00:49:56.609746	\N	\N	\N	\N	1
\.


--
-- Data for Name: system_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_notifications (id, notification_type, title, message, metadata, target_role, is_read, created_by, created_at, tenant_id) FROM stdin;
1	PAYMENT_OVERDUE	Payment OVERDUE: JET MACHINERY SDN BHD — 2026-01	Payment of 3000.00 was due on Thu Jan 15 and is still unpaid.	{"amount": 3000, "period": "2026-01", "due_date": "Thu Jan 15", "schedule_id": 1, "supplier_name": "JET MACHINERY SDN BHD"}	MANAGER	f	\N	2026-05-08 08:59:22.28721	1
2	PAYMENT_OVERDUE	Payment OVERDUE: JET MACHINERY SDN BHD — 2026-04	Payment of 3000.00 was due on Wed Apr 15 and is still unpaid.	{"amount": 3000, "period": "2026-04", "due_date": "Wed Apr 15", "schedule_id": 2, "supplier_name": "JET MACHINERY SDN BHD"}	MANAGER	f	\N	2026-05-08 08:59:22.291453	1
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (id, setting_key, setting_value, updated_by, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, code, name, status, plan, max_users, contact_email, contact_phone, created_at, updated_at, approved_at, approved_by, rejected_reason, rejected_at, rejected_by) FROM stdin;
1	DEFAULT	Default Company	ACTIVE	ENTERPRISE	999	admin@inventory.local	\N	2026-05-02 15:52:37.045533	2026-05-02 15:52:37.045533	\N	\N	\N	\N	\N
2	SYSTEM	Platform Administration	ACTIVE	ENTERPRISE	10	superadmin@inventory.local	\N	2026-05-02 15:52:37.218007	2026-05-02 15:52:37.218007	\N	\N	\N	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, full_name, email, password_hash, role, is_active, preferred_currency, created_at, tenant_id) FROM stdin;
1	Platform Super Admin	superadmin@inventory.local	$2b$10$c3OyYsBL9mwgdobhf/ZlJe42TGVXCsdpshIVZIoduCJl.1esGpTVW	SUPER_ADMIN	t	MYR	2026-05-02 15:52:37.218477	2
2	System Admin	admin@inventory.local	$2b$10$3kgfDm68MiQoCuoAOgCU5O6.yXQ.B34LYK3ocn3jwGuasF1HTmJAm	ADMIN	t	MYR	2026-05-02 15:53:19.270314	1
3	Warehouse Manager	manager@inventory.local	$2b$10$.2ayw6cbRXSRrctAdN.x1utdFbOsbuv3S46I7Uogps9Pl6YtLPevG	MANAGER	t	MYR	2026-05-02 15:53:19.270314	1
4	Testing Staff	staff@inventory.local	$2b$10$ObsYMjkQ23/V/Fe52MmMX.99BIkJVzHZRQMJvzfc9kSOpeyxUrEQ6	STAFF	t	MYR	2026-05-02 15:53:19.270314	1
5	Testing Account	test@inventory.local	$2b$10$X0qP1vGxzoNPlga2S3SGkOhB802p8ng1xvoLyy7zIe.cy0f7F55Wq	ADMIN	t	MYR	2026-05-02 15:53:19.270314	1
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouses (id, name, code, address, manager_name, is_active, created_at, tenant_id) FROM stdin;
1	Main	Main001	23, Batu 14, Jalan Utama 2/1, Taman Perindustrian Puchong Utama, 47100 Puchong, Selangor	Junyuan	t	2026-05-05 03:40:02.640947	1
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 62, true);


--
-- Name: bank_statements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bank_statements_id_seq', 1, false);


--
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.brands_id_seq', 61, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 197, true);


--
-- Name: delivery_order_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_order_attachments_id_seq', 1, false);


--
-- Name: delivery_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_order_items_id_seq', 17, true);


--
-- Name: delivery_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_orders_id_seq', 9, true);


--
-- Name: document_prompts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: inventory_user
--

SELECT pg_catalog.setval('public.document_prompts_id_seq', 2, true);


--
-- Name: low_stock_alert_states_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.low_stock_alert_states_id_seq', 1, false);


--
-- Name: marketplace_connections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_connections_id_seq', 1, false);


--
-- Name: marketplace_error_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_error_logs_id_seq', 1, false);


--
-- Name: marketplace_inventory_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_inventory_snapshots_id_seq', 1, false);


--
-- Name: marketplace_oauth_states_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_oauth_states_id_seq', 1, false);


--
-- Name: marketplace_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_order_items_id_seq', 1, false);


--
-- Name: marketplace_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_orders_id_seq', 1, false);


--
-- Name: marketplace_sync_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.marketplace_sync_logs_id_seq', 1, false);


--
-- Name: product_bundle_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_bundle_items_id_seq', 1, false);


--
-- Name: product_cost_price_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_cost_price_histories_id_seq', 1, false);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_images_id_seq', 1, false);


--
-- Name: product_pricing_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_pricing_rules_id_seq', 15, true);


--
-- Name: product_suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_suppliers_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 105, true);


--
-- Name: shipping_shipments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shipping_shipments_id_seq', 1, false);


--
-- Name: stock_count_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_count_items_id_seq', 14, true);


--
-- Name: stock_counts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_counts_id_seq', 1, true);


--
-- Name: stock_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_levels_id_seq', 20, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 20, true);


--
-- Name: supplier_invoice_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_invoice_attachments_id_seq', 1, false);


--
-- Name: supplier_invoice_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_invoice_items_id_seq', 14, true);


--
-- Name: supplier_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_invoices_id_seq', 8, true);


--
-- Name: supplier_payment_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_payment_records_id_seq', 1, false);


--
-- Name: supplier_payment_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_payment_schedules_id_seq', 8, true);


--
-- Name: supplier_return_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_return_attachments_id_seq', 1, false);


--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_return_items_id_seq', 1, true);


--
-- Name: supplier_returns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_returns_id_seq', 1, true);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 67, true);


--
-- Name: system_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_notifications_id_seq', 2, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, false);


--
-- Name: tenants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tenants_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: warehouses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warehouses_id_seq', 1, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_statements bank_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_pkey PRIMARY KEY (id);


--
-- Name: bank_statements bank_statements_uploaded_by_statement_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_uploaded_by_statement_month_key UNIQUE (uploaded_by, statement_month);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: brands brands_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: delivery_orders delivery_orders_tenant_id_do_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders
    ADD CONSTRAINT delivery_orders_tenant_id_do_no_key UNIQUE (tenant_id, do_no);


--
-- Name: document_prompts document_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: inventory_user
--

ALTER TABLE ONLY public.document_prompts
    ADD CONSTRAINT document_prompts_pkey PRIMARY KEY (id);


--
-- Name: document_prompts document_prompts_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: inventory_user
--

ALTER TABLE ONLY public.document_prompts
    ADD CONSTRAINT document_prompts_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: low_stock_alert_states low_stock_alert_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_pkey PRIMARY KEY (id);


--
-- Name: low_stock_alert_states low_stock_alert_states_product_id_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);


--
-- Name: marketplace_connections marketplace_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_connections
    ADD CONSTRAINT marketplace_connections_pkey PRIMARY KEY (id);


--
-- Name: marketplace_connections marketplace_connections_tenant_channel_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_connections
    ADD CONSTRAINT marketplace_connections_tenant_channel_unique UNIQUE (tenant_id, channel);


--
-- Name: marketplace_error_logs marketplace_error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_error_logs
    ADD CONSTRAINT marketplace_error_logs_pkey PRIMARY KEY (id);


--
-- Name: marketplace_inventory_snapshots marketplace_inventory_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_inventory_snapshots
    ADD CONSTRAINT marketplace_inventory_snapshots_pkey PRIMARY KEY (id);


--
-- Name: marketplace_oauth_states marketplace_oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_oauth_states
    ADD CONSTRAINT marketplace_oauth_states_pkey PRIMARY KEY (id);


--
-- Name: marketplace_oauth_states marketplace_oauth_states_state_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_oauth_states
    ADD CONSTRAINT marketplace_oauth_states_state_token_key UNIQUE (state_token);


--
-- Name: marketplace_order_items marketplace_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_order_items
    ADD CONSTRAINT marketplace_order_items_pkey PRIMARY KEY (id);


--
-- Name: marketplace_orders marketplace_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_pkey PRIMARY KEY (id);


--
-- Name: marketplace_orders marketplace_orders_tenant_channel_order_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_tenant_channel_order_unique UNIQUE (tenant_id, channel, external_order_id);


--
-- Name: marketplace_sync_logs marketplace_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_sync_logs
    ADD CONSTRAINT marketplace_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: product_bundle_items product_bundle_items_combo_product_id_item_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_combo_product_id_item_product_id_key UNIQUE (combo_product_id, item_product_id);


--
-- Name: product_bundle_items product_bundle_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_pkey PRIMARY KEY (id);


--
-- Name: product_cost_price_histories product_cost_price_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_cost_price_histories
    ADD CONSTRAINT product_cost_price_histories_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_pricing_rules product_pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_pricing_rules
    ADD CONSTRAINT product_pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: product_suppliers product_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_pkey PRIMARY KEY (id);


--
-- Name: product_suppliers product_suppliers_product_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_product_id_supplier_id_key UNIQUE (product_id, supplier_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: delivery_order_attachments purchase_order_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_attachments
    ADD CONSTRAINT purchase_order_attachments_pkey PRIMARY KEY (id);


--
-- Name: delivery_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: delivery_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: shipping_shipments shipping_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_shipments
    ADD CONSTRAINT shipping_shipments_pkey PRIMARY KEY (id);


--
-- Name: stock_count_items stock_count_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items
    ADD CONSTRAINT stock_count_items_pkey PRIMARY KEY (id);


--
-- Name: stock_count_items stock_count_items_stock_count_id_product_id_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items
    ADD CONSTRAINT stock_count_items_stock_count_id_product_id_warehouse_id_key UNIQUE (stock_count_id, product_id, warehouse_id);


--
-- Name: stock_counts stock_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_pkey PRIMARY KEY (id);


--
-- Name: stock_levels stock_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_pkey PRIMARY KEY (id);


--
-- Name: stock_levels stock_levels_product_id_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: supplier_brands supplier_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_brands
    ADD CONSTRAINT supplier_brands_pkey PRIMARY KEY (supplier_id, brand_id);


--
-- Name: supplier_invoice_attachments supplier_invoice_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_attachments
    ADD CONSTRAINT supplier_invoice_attachments_pkey PRIMARY KEY (id);


--
-- Name: supplier_invoice_items supplier_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_items
    ADD CONSTRAINT supplier_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: supplier_invoices supplier_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_pkey PRIMARY KEY (id);


--
-- Name: supplier_invoices supplier_invoices_tenant_id_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_tenant_id_invoice_no_key UNIQUE (tenant_id, invoice_no);


--
-- Name: supplier_payment_records supplier_payment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_records
    ADD CONSTRAINT supplier_payment_records_pkey PRIMARY KEY (id);


--
-- Name: supplier_payment_records supplier_payment_records_supplier_id_period_month_period_ye_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_records
    ADD CONSTRAINT supplier_payment_records_supplier_id_period_month_period_ye_key UNIQUE (supplier_id, period_month, period_year);


--
-- Name: supplier_payment_schedules supplier_payment_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_schedules
    ADD CONSTRAINT supplier_payment_schedules_pkey PRIMARY KEY (id);


--
-- Name: supplier_payment_schedules supplier_payment_schedules_tenant_id_supplier_id_period_mon_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_schedules
    ADD CONSTRAINT supplier_payment_schedules_tenant_id_supplier_id_period_mon_key UNIQUE (tenant_id, supplier_id, period_month, period_year);


--
-- Name: supplier_return_attachments supplier_return_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_attachments
    ADD CONSTRAINT supplier_return_attachments_pkey PRIMARY KEY (id);


--
-- Name: supplier_return_items supplier_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_pkey PRIMARY KEY (id);


--
-- Name: supplier_returns supplier_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_pkey PRIMARY KEY (id);


--
-- Name: supplier_returns supplier_returns_tenant_id_document_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_tenant_id_document_no_key UNIQUE (tenant_id, document_no);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_notifications system_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT system_notifications_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_tenant_setting_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_tenant_setting_key_unique UNIQUE (tenant_id, setting_key);


--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_bank_statements_statement_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_statements_statement_month ON public.bank_statements USING btree (statement_month DESC);


--
-- Name: idx_bank_statements_uploaded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_statements_uploaded_by ON public.bank_statements USING btree (uploaded_by);


--
-- Name: idx_brands_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_brands_tenant ON public.brands USING btree (tenant_id);


--
-- Name: idx_categories_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_categories_tenant_id ON public.categories USING btree (tenant_id);


--
-- Name: idx_categories_tenant_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_categories_tenant_name ON public.categories USING btree (tenant_id, name);


--
-- Name: idx_do_attachments_do_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_do_attachments_do_id ON public.delivery_order_attachments USING btree (do_id);


--
-- Name: idx_do_items_do_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_do_items_do_id ON public.delivery_order_items USING btree (do_id);


--
-- Name: idx_do_tenant_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_do_tenant_date ON public.delivery_orders USING btree (tenant_id, do_date DESC);


--
-- Name: idx_do_tenant_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_do_tenant_supplier ON public.delivery_orders USING btree (tenant_id, supplier_id);


--
-- Name: idx_document_prompts_one_default_per_tenant; Type: INDEX; Schema: public; Owner: inventory_user
--

CREATE UNIQUE INDEX idx_document_prompts_one_default_per_tenant ON public.document_prompts USING btree (tenant_id) WHERE (is_default = true);


--
-- Name: idx_inv_attachments_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_attachments_invoice_id ON public.supplier_invoice_attachments USING btree (invoice_id);


--
-- Name: idx_inv_do_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_do_id ON public.supplier_invoices USING btree (do_id);


--
-- Name: idx_inv_items_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_items_invoice_id ON public.supplier_invoice_items USING btree (invoice_id);


--
-- Name: idx_inv_tenant_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_tenant_date ON public.supplier_invoices USING btree (tenant_id, invoice_date DESC);


--
-- Name: idx_inv_tenant_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_tenant_supplier ON public.supplier_invoices USING btree (tenant_id, supplier_id);


--
-- Name: idx_low_stock_alert_states_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_low_stock_alert_states_status ON public.low_stock_alert_states USING btree (status);


--
-- Name: idx_low_stock_alert_states_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_low_stock_alert_states_tenant_id ON public.low_stock_alert_states USING btree (tenant_id);


--
-- Name: idx_marketplace_connections_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_connections_tenant_id ON public.marketplace_connections USING btree (tenant_id);


--
-- Name: idx_marketplace_error_logs_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_error_logs_channel ON public.marketplace_error_logs USING btree (channel);


--
-- Name: idx_marketplace_error_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_error_logs_created_at ON public.marketplace_error_logs USING btree (created_at DESC);


--
-- Name: idx_marketplace_error_logs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_error_logs_tenant_id ON public.marketplace_error_logs USING btree (tenant_id);


--
-- Name: idx_marketplace_oauth_states_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_oauth_states_channel ON public.marketplace_oauth_states USING btree (channel);


--
-- Name: idx_marketplace_oauth_states_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_oauth_states_expires_at ON public.marketplace_oauth_states USING btree (expires_at);


--
-- Name: idx_marketplace_order_items_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_order_items_order_id ON public.marketplace_order_items USING btree (marketplace_order_id);


--
-- Name: idx_marketplace_order_items_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_order_items_tenant_id ON public.marketplace_order_items USING btree (tenant_id);


--
-- Name: idx_marketplace_orders_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_orders_channel ON public.marketplace_orders USING btree (channel);


--
-- Name: idx_marketplace_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_orders_status ON public.marketplace_orders USING btree (order_status);


--
-- Name: idx_marketplace_orders_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_orders_tenant_id ON public.marketplace_orders USING btree (tenant_id);


--
-- Name: idx_marketplace_snapshots_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_snapshots_channel ON public.marketplace_inventory_snapshots USING btree (channel);


--
-- Name: idx_marketplace_sync_logs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketplace_sync_logs_tenant_id ON public.marketplace_sync_logs USING btree (tenant_id);


--
-- Name: idx_product_bundle_items_combo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_bundle_items_combo_id ON public.product_bundle_items USING btree (combo_product_id);


--
-- Name: idx_product_cost_price_histories_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_cost_price_histories_changed_at ON public.product_cost_price_histories USING btree (changed_at DESC);


--
-- Name: idx_product_cost_price_histories_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_cost_price_histories_product_id ON public.product_cost_price_histories USING btree (product_id);


--
-- Name: idx_product_images_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_images_product_id ON public.product_images USING btree (product_id);


--
-- Name: idx_product_pricing_rules_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_pricing_rules_product_id ON public.product_pricing_rules USING btree (product_id);


--
-- Name: idx_product_suppliers_is_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_suppliers_is_primary ON public.product_suppliers USING btree (is_primary);


--
-- Name: idx_product_suppliers_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_suppliers_product_id ON public.product_suppliers USING btree (product_id);


--
-- Name: idx_product_suppliers_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_suppliers_supplier_id ON public.product_suppliers USING btree (supplier_id);


--
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_brand ON public.products USING btree (brand_id);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_tenant_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_products_tenant_barcode ON public.products USING btree (tenant_id, barcode) WHERE (barcode IS NOT NULL);


--
-- Name: idx_products_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_tenant_id ON public.products USING btree (tenant_id);


--
-- Name: idx_products_tenant_product_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_products_tenant_product_code ON public.products USING btree (tenant_id, product_code) WHERE (product_code IS NOT NULL);


--
-- Name: idx_products_tenant_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_products_tenant_sku ON public.products USING btree (tenant_id, sku);


--
-- Name: idx_ret_attachments_return_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ret_attachments_return_id ON public.supplier_return_attachments USING btree (return_id);


--
-- Name: idx_ret_doc_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ret_doc_type ON public.supplier_returns USING btree (tenant_id, doc_type);


--
-- Name: idx_ret_items_return_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ret_items_return_id ON public.supplier_return_items USING btree (return_id);


--
-- Name: idx_ret_tenant_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ret_tenant_date ON public.supplier_returns USING btree (tenant_id, document_date DESC);


--
-- Name: idx_ret_tenant_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ret_tenant_supplier ON public.supplier_returns USING btree (tenant_id, supplier_id);


--
-- Name: idx_shipping_shipments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_shipments_status ON public.shipping_shipments USING btree (shipment_status);


--
-- Name: idx_shipping_shipments_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_shipments_tenant_id ON public.shipping_shipments USING btree (tenant_id);


--
-- Name: idx_sps_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sps_due_date ON public.supplier_payment_schedules USING btree (due_date);


--
-- Name: idx_sps_monthly_reminded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sps_monthly_reminded ON public.supplier_payment_schedules USING btree (tenant_id, monthly_reminded_month, status);


--
-- Name: idx_sps_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sps_status ON public.supplier_payment_schedules USING btree (status);


--
-- Name: idx_sps_tenant_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sps_tenant_supplier ON public.supplier_payment_schedules USING btree (tenant_id, supplier_id);


--
-- Name: idx_stock_count_items_stock_count_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_count_items_stock_count_id ON public.stock_count_items USING btree (stock_count_id);


--
-- Name: idx_stock_counts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_counts_status ON public.stock_counts USING btree (status);


--
-- Name: idx_stock_counts_warehouse_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_counts_warehouse_id ON public.stock_counts USING btree (warehouse_id);


--
-- Name: idx_stock_levels_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_levels_product_id ON public.stock_levels USING btree (product_id);


--
-- Name: idx_stock_levels_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_levels_tenant_id ON public.stock_levels USING btree (tenant_id);


--
-- Name: idx_stock_levels_warehouse_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_levels_warehouse_id ON public.stock_levels USING btree (warehouse_id);


--
-- Name: idx_stock_movements_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_created_at ON public.stock_movements USING btree (created_at DESC);


--
-- Name: idx_stock_movements_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);


--
-- Name: idx_stock_movements_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_tenant_id ON public.stock_movements USING btree (tenant_id);


--
-- Name: idx_supplier_brands_brand; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_brands_brand ON public.supplier_brands USING btree (brand_id);


--
-- Name: idx_supplier_brands_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_brands_tenant ON public.supplier_brands USING btree (tenant_id);


--
-- Name: idx_supplier_payment_records_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_payment_records_period ON public.supplier_payment_records USING btree (period_year DESC, period_month DESC);


--
-- Name: idx_supplier_payment_records_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_payment_records_supplier_id ON public.supplier_payment_records USING btree (supplier_id);


--
-- Name: idx_suppliers_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_is_active ON public.suppliers USING btree (is_active);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_suppliers_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_tenant_id ON public.suppliers USING btree (tenant_id);


--
-- Name: idx_system_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_notifications_created_at ON public.system_notifications USING btree (created_at DESC);


--
-- Name: idx_system_notifications_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_notifications_tenant_id ON public.system_notifications USING btree (tenant_id);


--
-- Name: idx_system_notifications_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_notifications_type ON public.system_notifications USING btree (notification_type);


--
-- Name: idx_system_settings_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_settings_tenant_id ON public.system_settings USING btree (tenant_id);


--
-- Name: idx_tenants_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenants_code ON public.tenants USING btree (code);


--
-- Name: idx_tenants_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenants_status ON public.tenants USING btree (status);


--
-- Name: idx_tenants_status_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenants_status_pending ON public.tenants USING btree (status) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: idx_users_tenant_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_users_tenant_email ON public.users USING btree (tenant_id, email);


--
-- Name: idx_users_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);


--
-- Name: idx_warehouses_tenant_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_warehouses_tenant_code ON public.warehouses USING btree (tenant_id, code);


--
-- Name: idx_warehouses_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_tenant_id ON public.warehouses USING btree (tenant_id);


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_statements bank_statements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: bank_statements bank_statements_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statements
    ADD CONSTRAINT bank_statements_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: brands brands_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: categories categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: delivery_orders delivery_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders
    ADD CONSTRAINT delivery_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: document_prompts document_prompts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: inventory_user
--

ALTER TABLE ONLY public.document_prompts
    ADD CONSTRAINT document_prompts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_prompts document_prompts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: inventory_user
--

ALTER TABLE ONLY public.document_prompts
    ADD CONSTRAINT document_prompts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: low_stock_alert_states low_stock_alert_states_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: low_stock_alert_states low_stock_alert_states_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: low_stock_alert_states low_stock_alert_states_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: low_stock_alert_states low_stock_alert_states_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: low_stock_alert_states low_stock_alert_states_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_alert_states
    ADD CONSTRAINT low_stock_alert_states_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: marketplace_connections marketplace_connections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_connections
    ADD CONSTRAINT marketplace_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: marketplace_connections marketplace_connections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_connections
    ADD CONSTRAINT marketplace_connections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_error_logs marketplace_error_logs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_error_logs
    ADD CONSTRAINT marketplace_error_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_error_logs marketplace_error_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_error_logs
    ADD CONSTRAINT marketplace_error_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: marketplace_inventory_snapshots marketplace_inventory_snapshots_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_inventory_snapshots
    ADD CONSTRAINT marketplace_inventory_snapshots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: marketplace_inventory_snapshots marketplace_inventory_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_inventory_snapshots
    ADD CONSTRAINT marketplace_inventory_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: marketplace_inventory_snapshots marketplace_inventory_snapshots_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_inventory_snapshots
    ADD CONSTRAINT marketplace_inventory_snapshots_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: marketplace_oauth_states marketplace_oauth_states_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_oauth_states
    ADD CONSTRAINT marketplace_oauth_states_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_oauth_states marketplace_oauth_states_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_oauth_states
    ADD CONSTRAINT marketplace_oauth_states_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: marketplace_order_items marketplace_order_items_marketplace_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_order_items
    ADD CONSTRAINT marketplace_order_items_marketplace_order_id_fkey FOREIGN KEY (marketplace_order_id) REFERENCES public.marketplace_orders(id) ON DELETE CASCADE;


--
-- Name: marketplace_order_items marketplace_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_order_items
    ADD CONSTRAINT marketplace_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: marketplace_order_items marketplace_order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_order_items
    ADD CONSTRAINT marketplace_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: marketplace_orders marketplace_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: marketplace_sync_logs marketplace_sync_logs_synced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_sync_logs
    ADD CONSTRAINT marketplace_sync_logs_synced_by_fkey FOREIGN KEY (synced_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_sync_logs marketplace_sync_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_sync_logs
    ADD CONSTRAINT marketplace_sync_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_bundle_items product_bundle_items_combo_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_combo_product_id_fkey FOREIGN KEY (combo_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_bundle_items product_bundle_items_item_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_item_product_id_fkey FOREIGN KEY (item_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_bundle_items product_bundle_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_bundle_items
    ADD CONSTRAINT product_bundle_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_cost_price_histories product_cost_price_histories_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_cost_price_histories
    ADD CONSTRAINT product_cost_price_histories_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: product_cost_price_histories product_cost_price_histories_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_cost_price_histories
    ADD CONSTRAINT product_cost_price_histories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_cost_price_histories product_cost_price_histories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_cost_price_histories
    ADD CONSTRAINT product_cost_price_histories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_pricing_rules product_pricing_rules_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_pricing_rules
    ADD CONSTRAINT product_pricing_rules_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_pricing_rules product_pricing_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_pricing_rules
    ADD CONSTRAINT product_pricing_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_suppliers product_suppliers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: product_suppliers product_suppliers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_suppliers product_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: product_suppliers product_suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: delivery_order_attachments purchase_order_attachments_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_attachments
    ADD CONSTRAINT purchase_order_attachments_po_id_fkey FOREIGN KEY (do_id) REFERENCES public.delivery_orders(id) ON DELETE CASCADE;


--
-- Name: delivery_order_attachments purchase_order_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_attachments
    ADD CONSTRAINT purchase_order_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: delivery_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (do_id) REFERENCES public.delivery_orders(id) ON DELETE CASCADE;


--
-- Name: delivery_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: delivery_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: delivery_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: delivery_orders purchase_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_orders
    ADD CONSTRAINT purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: shipping_shipments shipping_shipments_marketplace_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_shipments
    ADD CONSTRAINT shipping_shipments_marketplace_order_id_fkey FOREIGN KEY (marketplace_order_id) REFERENCES public.marketplace_orders(id) ON DELETE SET NULL;


--
-- Name: shipping_shipments shipping_shipments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_shipments
    ADD CONSTRAINT shipping_shipments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: shipping_shipments shipping_shipments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_shipments
    ADD CONSTRAINT shipping_shipments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_count_items stock_count_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items
    ADD CONSTRAINT stock_count_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_count_items stock_count_items_stock_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items
    ADD CONSTRAINT stock_count_items_stock_count_id_fkey FOREIGN KEY (stock_count_id) REFERENCES public.stock_counts(id) ON DELETE CASCADE;


--
-- Name: stock_count_items stock_count_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items
    ADD CONSTRAINT stock_count_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: stock_count_items stock_count_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_items
    ADD CONSTRAINT stock_count_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_counts stock_counts_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_counts stock_counts_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_counts stock_counts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_counts stock_counts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: stock_counts stock_counts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_levels stock_levels_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_levels stock_levels_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: stock_levels stock_levels_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_destination_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_destination_warehouse_id_fkey FOREIGN KEY (destination_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_source_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_source_warehouse_id_fkey FOREIGN KEY (source_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: supplier_brands supplier_brands_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_brands
    ADD CONSTRAINT supplier_brands_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_brands supplier_brands_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_brands
    ADD CONSTRAINT supplier_brands_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_invoice_attachments supplier_invoice_attachments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_attachments
    ADD CONSTRAINT supplier_invoice_attachments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.supplier_invoices(id) ON DELETE CASCADE;


--
-- Name: supplier_invoice_attachments supplier_invoice_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_attachments
    ADD CONSTRAINT supplier_invoice_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_invoice_items supplier_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_items
    ADD CONSTRAINT supplier_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.supplier_invoices(id) ON DELETE CASCADE;


--
-- Name: supplier_invoice_items supplier_invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoice_items
    ADD CONSTRAINT supplier_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: supplier_invoices supplier_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_invoices supplier_invoices_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_po_id_fkey FOREIGN KEY (do_id) REFERENCES public.delivery_orders(id) ON DELETE RESTRICT;


--
-- Name: supplier_invoices supplier_invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: supplier_invoices supplier_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: supplier_invoices supplier_invoices_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: supplier_payment_records supplier_payment_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_records
    ADD CONSTRAINT supplier_payment_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_payment_records supplier_payment_records_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_records
    ADD CONSTRAINT supplier_payment_records_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_payment_records supplier_payment_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_records
    ADD CONSTRAINT supplier_payment_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: supplier_payment_schedules supplier_payment_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_schedules
    ADD CONSTRAINT supplier_payment_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_payment_schedules supplier_payment_schedules_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_schedules
    ADD CONSTRAINT supplier_payment_schedules_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_payment_schedules supplier_payment_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_payment_schedules
    ADD CONSTRAINT supplier_payment_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: supplier_return_attachments supplier_return_attachments_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_attachments
    ADD CONSTRAINT supplier_return_attachments_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.supplier_returns(id) ON DELETE CASCADE;


--
-- Name: supplier_return_attachments supplier_return_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_attachments
    ADD CONSTRAINT supplier_return_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_return_items supplier_return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: supplier_return_items supplier_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.supplier_returns(id) ON DELETE CASCADE;


--
-- Name: supplier_returns supplier_returns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_returns supplier_returns_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: supplier_returns supplier_returns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: suppliers suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_notifications system_notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT system_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_notifications system_notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT system_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tenants tenants_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tenants tenants_rejected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO inventory_user;


--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO inventory_user;


--
-- Name: TABLE bank_statements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bank_statements TO inventory_user;


--
-- Name: SEQUENCE bank_statements_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bank_statements_id_seq TO inventory_user;


--
-- Name: TABLE brands; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.brands TO inventory_user;


--
-- Name: SEQUENCE brands_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.brands_id_seq TO inventory_user;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.categories TO inventory_user;


--
-- Name: SEQUENCE categories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.categories_id_seq TO inventory_user;


--
-- Name: TABLE delivery_order_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.delivery_order_attachments TO inventory_user;


--
-- Name: SEQUENCE delivery_order_attachments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.delivery_order_attachments_id_seq TO inventory_user;


--
-- Name: TABLE delivery_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.delivery_order_items TO inventory_user;


--
-- Name: SEQUENCE delivery_order_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.delivery_order_items_id_seq TO inventory_user;


--
-- Name: TABLE delivery_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.delivery_orders TO inventory_user;


--
-- Name: SEQUENCE delivery_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.delivery_orders_id_seq TO inventory_user;


--
-- Name: TABLE low_stock_alert_states; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.low_stock_alert_states TO inventory_user;


--
-- Name: SEQUENCE low_stock_alert_states_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.low_stock_alert_states_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_connections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_connections TO inventory_user;


--
-- Name: SEQUENCE marketplace_connections_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_connections_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_error_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_error_logs TO inventory_user;


--
-- Name: SEQUENCE marketplace_error_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_error_logs_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_inventory_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_inventory_snapshots TO inventory_user;


--
-- Name: SEQUENCE marketplace_inventory_snapshots_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_inventory_snapshots_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_oauth_states; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_oauth_states TO inventory_user;


--
-- Name: SEQUENCE marketplace_oauth_states_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_oauth_states_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_order_items TO inventory_user;


--
-- Name: SEQUENCE marketplace_order_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_order_items_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_orders TO inventory_user;


--
-- Name: SEQUENCE marketplace_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_orders_id_seq TO inventory_user;


--
-- Name: TABLE marketplace_sync_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_sync_logs TO inventory_user;


--
-- Name: SEQUENCE marketplace_sync_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.marketplace_sync_logs_id_seq TO inventory_user;


--
-- Name: TABLE product_bundle_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_bundle_items TO inventory_user;


--
-- Name: SEQUENCE product_bundle_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.product_bundle_items_id_seq TO inventory_user;


--
-- Name: TABLE product_cost_price_histories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_cost_price_histories TO inventory_user;


--
-- Name: SEQUENCE product_cost_price_histories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.product_cost_price_histories_id_seq TO inventory_user;


--
-- Name: TABLE product_images; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_images TO inventory_user;


--
-- Name: SEQUENCE product_images_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.product_images_id_seq TO inventory_user;


--
-- Name: TABLE product_pricing_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_pricing_rules TO inventory_user;


--
-- Name: SEQUENCE product_pricing_rules_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.product_pricing_rules_id_seq TO inventory_user;


--
-- Name: TABLE product_suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_suppliers TO inventory_user;


--
-- Name: SEQUENCE product_suppliers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.product_suppliers_id_seq TO inventory_user;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO inventory_user;


--
-- Name: SEQUENCE products_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.products_id_seq TO inventory_user;


--
-- Name: TABLE shipping_shipments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shipping_shipments TO inventory_user;


--
-- Name: SEQUENCE shipping_shipments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.shipping_shipments_id_seq TO inventory_user;


--
-- Name: TABLE stock_count_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_count_items TO inventory_user;


--
-- Name: SEQUENCE stock_count_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stock_count_items_id_seq TO inventory_user;


--
-- Name: TABLE stock_counts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_counts TO inventory_user;


--
-- Name: SEQUENCE stock_counts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stock_counts_id_seq TO inventory_user;


--
-- Name: TABLE stock_levels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_levels TO inventory_user;


--
-- Name: SEQUENCE stock_levels_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stock_levels_id_seq TO inventory_user;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_movements TO inventory_user;


--
-- Name: SEQUENCE stock_movements_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stock_movements_id_seq TO inventory_user;


--
-- Name: TABLE supplier_brands; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_brands TO inventory_user;


--
-- Name: TABLE supplier_invoice_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_invoice_attachments TO inventory_user;


--
-- Name: SEQUENCE supplier_invoice_attachments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_invoice_attachments_id_seq TO inventory_user;


--
-- Name: TABLE supplier_invoice_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_invoice_items TO inventory_user;


--
-- Name: SEQUENCE supplier_invoice_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_invoice_items_id_seq TO inventory_user;


--
-- Name: TABLE supplier_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_invoices TO inventory_user;


--
-- Name: SEQUENCE supplier_invoices_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_invoices_id_seq TO inventory_user;


--
-- Name: TABLE supplier_payment_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_payment_records TO inventory_user;


--
-- Name: SEQUENCE supplier_payment_records_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_payment_records_id_seq TO inventory_user;


--
-- Name: TABLE supplier_payment_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_payment_schedules TO inventory_user;


--
-- Name: SEQUENCE supplier_payment_schedules_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_payment_schedules_id_seq TO inventory_user;


--
-- Name: TABLE supplier_return_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_return_attachments TO inventory_user;


--
-- Name: SEQUENCE supplier_return_attachments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_return_attachments_id_seq TO inventory_user;


--
-- Name: TABLE supplier_return_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_return_items TO inventory_user;


--
-- Name: SEQUENCE supplier_return_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_return_items_id_seq TO inventory_user;


--
-- Name: TABLE supplier_returns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_returns TO inventory_user;


--
-- Name: SEQUENCE supplier_returns_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.supplier_returns_id_seq TO inventory_user;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.suppliers TO inventory_user;


--
-- Name: SEQUENCE suppliers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.suppliers_id_seq TO inventory_user;


--
-- Name: TABLE system_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_notifications TO inventory_user;


--
-- Name: SEQUENCE system_notifications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.system_notifications_id_seq TO inventory_user;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_settings TO inventory_user;


--
-- Name: SEQUENCE system_settings_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.system_settings_id_seq TO inventory_user;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tenants TO inventory_user;


--
-- Name: SEQUENCE tenants_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tenants_id_seq TO inventory_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO inventory_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO inventory_user;


--
-- Name: TABLE warehouses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.warehouses TO inventory_user;


--
-- Name: SEQUENCE warehouses_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.warehouses_id_seq TO inventory_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO inventory_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO inventory_user;


--
-- PostgreSQL database dump complete
--

\unrestrict OJEJR3Uc8GL8rH9qvzfUtgJYfsz5OlEp09CYWaVt2UQ5gwCe6WpAooh43JJPMve

