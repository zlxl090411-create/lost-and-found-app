-- ====================================================================
-- 고등학교 분실물 게시판 - 데이터베이스 설정 SQL
-- Supabase 프로젝트 대시보드 > SQL Editor 에 이 파일 내용을 전부 붙여넣고
-- "Run" 버튼을 누르면 필요한 테이블과 보안 규칙이 한 번에 만들어집니다.
-- ====================================================================

-- 1. 역할(선생님/어드민) 정보를 저장하는 테이블
-- Supabase Auth로 로그인 계정을 만든 뒤, 이 표에 role을 지정해줘야 합니다.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('teacher', 'admin')),
  created_at timestamptz default now()
);

-- 2. 분실물 테이블
create table if not exists lost_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text not null,        -- 습득 장소
  found_date date not null,      -- 습득 날짜 (여기서 90일 후 자동 폐기일 계산)
  photo_url text,                -- 사진 URL (Supabase Storage에 업로드 후 저장)
  status text not null default 'unclaimed' check (status in ('unclaimed', 'claimed')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 공지사항 테이블
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. 학교 정보 테이블 (한 줄만 사용 - 학교 이름, 주소, 연락처 등을 하나의 텍스트/JSON으로 관리)
create table if not exists school_info (
  id int primary key default 1,
  content text not null default '',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into school_info (id, content) values (1, '학교 정보를 입력해주세요.')
  on conflict (id) do nothing;

-- ====================================================================
-- 보안 규칙(Row Level Security) 설정
-- 학생 화면(로그인 없음)은 "읽기"만 가능하고,
-- "쓰기(등록/수정/삭제)"는 teacher, admin 역할을 가진 로그인 계정만 가능합니다.
-- ====================================================================

alter table profiles enable row level security;
alter table lost_items enable row level security;
alter table notices enable row level security;
alter table school_info enable row level security;

-- 현재 로그인한 사용자의 role을 확인하는 함수
create or replace function get_my_role()
returns text
language sql security definer stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- profiles: 본인 정보만 조회 가능
create policy "본인 프로필 조회" on profiles
  for select using (auth.uid() = id);

-- lost_items: 누구나(학생 포함, 로그인 없이) 조회 가능
create policy "분실물 누구나 조회" on lost_items
  for select using (true);

-- lost_items: teacher, admin만 등록 가능
create policy "분실물 등록은 교사/관리자만" on lost_items
  for insert with check (get_my_role() in ('teacher', 'admin'));

-- lost_items: teacher, admin만 수정(완료 처리 등) 가능
create policy "분실물 수정은 교사/관리자만" on lost_items
  for update using (get_my_role() in ('teacher', 'admin'));

-- lost_items: teacher, admin만 삭제 가능
create policy "분실물 삭제는 교사/관리자만" on lost_items
  for delete using (get_my_role() in ('teacher', 'admin'));

-- notices: 누구나 조회 가능
create policy "공지 누구나 조회" on notices
  for select using (true);

-- notices: admin만 등록/수정/삭제 가능
create policy "공지 등록은 관리자만" on notices
  for insert with check (get_my_role() = 'admin');
create policy "공지 수정은 관리자만" on notices
  for update using (get_my_role() = 'admin');
create policy "공지 삭제는 관리자만" on notices
  for delete using (get_my_role() = 'admin');

-- school_info: 누구나 조회 가능
create policy "학교정보 누구나 조회" on school_info
  for select using (true);

-- school_info: admin만 수정 가능
create policy "학교정보 수정은 관리자만" on school_info
  for update using (get_my_role() = 'admin');

-- ====================================================================
-- 실시간 업데이트(Realtime) 활성화
-- ====================================================================
alter publication supabase_realtime add table lost_items;
alter publication supabase_realtime add table notices;
alter publication supabase_realtime add table school_info;

-- ====================================================================
-- 계정 생성 후 이 부분을 수정해서 실행하세요 (역할 지정)
-- 1) Supabase 대시보드 > Authentication > Users 에서 선생님/관리자 이메일 계정을 먼저 만드세요.
-- 2) 아래 예시처럼 그 계정의 이메일과 역할을 지정해서 실행하세요.
-- ====================================================================
-- 예시:
-- insert into profiles (id, email, role)
-- values (
--   (select id from auth.users where email = '선생님이메일@school.com'),
--   '선생님이메일@school.com',
--   'teacher'
-- );
--
-- insert into profiles (id, email, role)
-- values (
--   (select id from auth.users where email = '관리자이메일@school.com'),
--   '관리자이메일@school.com',
--   'admin'
-- );
