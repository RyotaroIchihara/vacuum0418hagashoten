-- =============================================================
-- Supabase セットアップ SQL
-- vacuum-event-20260418 予約サイト
-- =============================================================
-- Supabase ダッシュボード > SQL Editor で実行してください。
-- =============================================================


-- ---------------------------------------------------------------
-- 1. reservations テーブル
-- ---------------------------------------------------------------
CREATE TABLE public.reservations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  x_account   TEXT,
  slot_time   INT         NOT NULL CHECK (slot_time BETWEEN 12 AND 17),
  experience  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 同一メール・同一枠の重複予約を防ぐ
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_email_slot_unique UNIQUE (email, slot_time);


-- ---------------------------------------------------------------
-- 2. slots テーブル（公開可・集計済みカウント用）
-- ---------------------------------------------------------------
CREATE TABLE public.slots (
  slot_time      INT PRIMARY KEY CHECK (slot_time BETWEEN 12 AND 17),
  capacity       INT NOT NULL DEFAULT 3,
  reserved_count INT NOT NULL DEFAULT 0 CHECK (reserved_count >= 0)
);

-- 時間枠の初期データ
INSERT INTO public.slots (slot_time)
  VALUES (12), (13), (14), (15), (16), (17);


-- ---------------------------------------------------------------
-- 3. トリガー関数
-- ---------------------------------------------------------------

-- 満席チェック（INSERT 前・FOR UPDATE で同時実行を防ぐ）
CREATE OR REPLACE FUNCTION public.check_slot_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity      INT;
  v_reserved      INT;
BEGIN
  SELECT capacity, reserved_count
    INTO v_capacity, v_reserved
    FROM public.slots
   WHERE slot_time = NEW.slot_time
     FOR UPDATE;

  IF v_reserved >= v_capacity THEN
    RAISE EXCEPTION 'slot_full';
  END IF;

  RETURN NEW;
END;
$$;

-- 予約数カウントアップ（INSERT 後）
CREATE OR REPLACE FUNCTION public.increment_reserved_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.slots
     SET reserved_count = reserved_count + 1
   WHERE slot_time = NEW.slot_time;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_reservation_insert
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_slot_capacity();

CREATE TRIGGER after_reservation_insert
  AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.increment_reserved_count();


-- ---------------------------------------------------------------
-- 4. Row Level Security（RLS）
-- ---------------------------------------------------------------
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots        ENABLE ROW LEVEL SECURITY;

-- slots: 全員が読める（匿名ユーザー含む）
CREATE POLICY "anyone_select_slots"
  ON public.slots
  FOR SELECT
  USING (true);

-- reservations: 匿名ユーザーは INSERT のみ（個人情報を読み取り不可）
CREATE POLICY "anon_insert_reservations"
  ON public.reservations
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- reservations: 認証済みユーザー（管理者）は全件 SELECT 可
CREATE POLICY "auth_select_reservations"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (true);


-- =============================================================
-- 5. 管理者アカウントの作成
-- =============================================================
-- Supabase ダッシュボード > Authentication > Users > "Add user"
-- から管理者のメールアドレスとパスワードを設定してください。
-- /admin/export/csv/ や /admin/export/json/ でそのアカウントで
-- ログインすると予約一覧を閲覧できます。
-- =============================================================
