'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function TeacherLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setErrorMsg('이메일 또는 비밀번호가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profile && (profile.role === 'teacher' || profile.role === 'admin')) {
        router.push('/teacher/dashboard');
        router.refresh();
      } else {
        await supabase.auth.signOut();
        setErrorMsg('선생님/관리자 권한이 있는 계정이 아닙니다.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md" style={{ margin: '80px auto', maxWidth: 400 }}>
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800" style={{ marginBottom: 20, textAlign: 'center' }}>선생님 로그인</h1>
        {errorMsg && (
          <div style={{ padding: 10, marginBottom: 15, background: '#fee2e2', color: '#dc2626', borderRadius: 6, fontSize: 14 }}>
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 5 }}>이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bongil2026@gmail.com"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 5 }}>비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{ width: '100%', padding: 12, marginTop: 10, cursor: 'pointer' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
