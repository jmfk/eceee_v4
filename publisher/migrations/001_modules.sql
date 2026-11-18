-- Additive, repeatable installation. Run as the schema owner, never at request time.
CREATE SCHEMA IF NOT EXISTS modules;
CREATE TABLE IF NOT EXISTS modules.config (
  tenant_id uuid PRIMARY KEY REFERENCES public.core_tenant(id),
  commerce boolean NOT NULL DEFAULT false, support boolean NOT NULL DEFAULT false,
  faq boolean NOT NULL DEFAULT false, forum boolean NOT NULL DEFAULT false,
  portal_test_id text, portal_live_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS modules.products (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200), description text NOT NULL DEFAULT '',
  access_key text NOT NULL CHECK (access_key ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'),
  access_days integer CHECK (access_days BETWEEN 1 AND 36500),
  active boolean NOT NULL DEFAULT true, stripe_id text, mode text NOT NULL CHECK(mode IN ('test','live')),
  revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,mode,stripe_id)
);
CREATE TABLE IF NOT EXISTS modules.prices (
  tenant_id uuid NOT NULL, id uuid NOT NULL, product_id uuid NOT NULL,
  amount integer NOT NULL CHECK(amount > 0 AND amount <= 99999999),
  currency text NOT NULL CHECK(currency ~ '^[a-z]{3}$'),
  interval text NOT NULL CHECK(interval IN ('once','month','year')),
  active boolean NOT NULL DEFAULT true, stripe_id text NOT NULL, mode text NOT NULL CHECK(mode IN ('test','live')),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,mode,stripe_id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES modules.products(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS modules.customers (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), user_id integer NOT NULL REFERENCES public.auth_user(id),
  mode text NOT NULL CHECK(mode IN ('test','live')), stripe_id text NOT NULL,
  PRIMARY KEY(tenant_id,user_id,mode), UNIQUE(tenant_id,mode,stripe_id)
);
CREATE TABLE IF NOT EXISTS modules.purchases (
  tenant_id uuid NOT NULL, id uuid NOT NULL, user_id integer NOT NULL REFERENCES public.auth_user(id), price_id uuid NOT NULL,
  subscription_price_id uuid,
  request_key uuid NOT NULL, mode text NOT NULL CHECK(mode IN ('test','live')),
  access_key text NOT NULL, access_days integer,
  status text NOT NULL DEFAULT 'pending', session_id text, subscription_id text,
  payment_intent_id text, invoice_id text, cancel_at_period_end boolean NOT NULL DEFAULT false,
  paid_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,user_id,request_key), UNIQUE(tenant_id,mode,session_id),
  UNIQUE(tenant_id,mode,subscription_id),
  FOREIGN KEY(tenant_id,subscription_price_id) REFERENCES modules.prices(tenant_id,id), FOREIGN KEY(tenant_id,price_id) REFERENCES modules.prices(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS purchases_user ON modules.purchases(tenant_id,user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS modules.organizations (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), id uuid NOT NULL, name text NOT NULL,
  PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS modules.memberships (
  tenant_id uuid NOT NULL, organization_id uuid NOT NULL, user_id integer NOT NULL REFERENCES public.auth_user(id),
  valid_until timestamptz, active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(tenant_id,organization_id,user_id),
  FOREIGN KEY(tenant_id,organization_id) REFERENCES modules.organizations(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS modules.grants (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), id uuid NOT NULL, user_id integer REFERENCES public.auth_user(id),
  organization_id uuid, access_key text NOT NULL, source text NOT NULL CHECK(source IN ('purchase','organization','admin')),
  source_id uuid NOT NULL, starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
  revoked boolean NOT NULL DEFAULT false, reason text NOT NULL DEFAULT '', created_by integer REFERENCES public.auth_user(id),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,source,source_id,access_key),
  CHECK ((user_id IS NOT NULL)::integer + (organization_id IS NOT NULL)::integer = 1),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  FOREIGN KEY(tenant_id,organization_id) REFERENCES modules.organizations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS grants_user ON modules.grants(tenant_id,user_id,access_key);
CREATE INDEX IF NOT EXISTS grants_organization ON modules.grants(tenant_id,organization_id,access_key);
CREATE TABLE IF NOT EXISTS modules.webhook_events (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), mode text NOT NULL, id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,mode,id)
);
CREATE TABLE IF NOT EXISTS modules.faqs (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), id uuid NOT NULL,
  question text NOT NULL CHECK(length(question) BETWEEN 1 AND 300), answer text NOT NULL CHECK(length(answer) BETWEEN 1 AND 20000),
  published boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0,
  PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS modules.threads (
  tenant_id uuid NOT NULL REFERENCES public.core_tenant(id), id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('support','forum')), owner_id integer NOT NULL REFERENCES public.auth_user(id),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS threads_owner ON modules.threads(tenant_id,kind,owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS modules.messages (
  tenant_id uuid NOT NULL, id uuid NOT NULL, thread_id uuid NOT NULL,
  author_id integer NOT NULL REFERENCES public.auth_user(id), author_name text NOT NULL,
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 20000), hidden boolean NOT NULL DEFAULT false,
  request_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,author_id,request_key),
  FOREIGN KEY(tenant_id,thread_id) REFERENCES modules.threads(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS messages_thread ON modules.messages(tenant_id,thread_id,created_at,id);
-- No tenant context means no rows, including for the table owner.
DO $$ DECLARE item text; BEGIN
  FOREACH item IN ARRAY ARRAY['config','products','prices','customers','purchases','organizations','memberships','grants','webhook_events','faqs','threads','messages'] LOOP
    EXECUTE format('ALTER TABLE modules.%I ENABLE ROW LEVEL SECURITY',item);
    EXECUTE format('ALTER TABLE modules.%I FORCE ROW LEVEL SECURITY',item);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='modules' AND tablename=item AND policyname='tenant_scope') THEN
      EXECUTE format('CREATE POLICY tenant_scope ON modules.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',item);
    END IF;
  END LOOP;
END $$;
