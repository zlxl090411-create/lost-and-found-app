'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400, backgroundColor: 'white', padding: 24, borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: 24, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>선생님 로그인</h1>
        {errorMsg && (
          <div style={{ padding: 10, marginBottom: 16, backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: 6, fontSize: 14 }}>
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: '#374151' }}>이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bongil2026@gmail.com"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: '#374151' }}>비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px 0', backgroundColor: '#2563eb', color: 'white', borderRadius: 6, border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
