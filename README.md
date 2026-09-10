# 고등학교 분실물 게시판 - 배포 가이드

코딩 지식이 없어도 아래 순서대로 따라오시면 실제 인터넷 링크로 배포할 수 있습니다.
아래 순서는 채팅에서 안내드린 단계별 카드와 동일합니다. 막히는 부분이 있으면 캡처해서 다시 물어보셔도 됩니다.

## 1. Supabase 프로젝트 만들기
- supabase.com 접속 → 회원가입 → New Project 생성 (이름/비밀번호는 자유롭게)

## 2. 데이터베이스 설정
- 프로젝트 대시보드 왼쪽 메뉴 "SQL Editor" 클릭 → New query
- 이 폴더의 `supabase/schema.sql` 내용을 전부 복사해서 붙여넣고 Run 실행

## 3. 사진 저장 공간(Storage) 만들기
- 왼쪽 메뉴 "Storage" → New bucket → 이름 `lost-item-photos` → Public bucket 체크 → 생성

## 4. 선생님/관리자 로그인 계정 만들기
- 왼쪽 메뉴 "Authentication" → Users → Add user → 이메일/비밀번호 직접 지정해서 생성 (교사용 1개, 관리자용 1개 이상)
- 다시 SQL Editor로 가서 `schema.sql` 맨 아래에 있는 예시 INSERT문의 이메일 부분을 방금 만든 계정 이메일로 바꿔서 실행 (role을 'teacher' 또는 'admin'으로 지정)

## 5. API 키 복사
- 왼쪽 메뉴 "Project Settings" → API → Project URL, anon public key 복사해두기

## 6. GitHub에 코드 업로드
- github.com 가입 → New repository 생성 (이름 예: lost-and-found-app)
- "uploading an existing file" 링크로 이 폴더 안의 모든 파일/폴더를 드래그해서 업로드 → Commit

## 7. Vercel로 배포
- vercel.com 가입 (GitHub 계정으로 로그인 추천) → New Project → 방금 만든 GitHub 저장소 Import
- Environment Variables에 아래 두 개 추가
  - `NEXT_PUBLIC_SUPABASE_URL` = 5번에서 복사한 Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 5번에서 복사한 anon public key
- Deploy 클릭

## 8. 완료
- 배포가 끝나면 Vercel이 `https://프로젝트이름.vercel.app` 형태의 링크를 줍니다.
- 이 링크를 학생/선생님 모두에게 공유하면 됩니다.
- 기본 화면은 학생용, 우측 상단 "선생님 로그인" / "관리자 로그인"으로 각각 접속합니다.
