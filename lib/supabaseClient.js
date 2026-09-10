import { createClient } from '@supabase/supabase-js';

// 이 두 값은 Vercel의 "환경 변수(Environment Variables)"에 등록합니다.
// 절대 코드 안에 실제 키를 직접 적지 마세요.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
