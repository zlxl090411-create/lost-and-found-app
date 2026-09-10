'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function TeacherLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (!profile || profile.role !== 'teacher') {
      setError('선생님 계정 권한이 없습니다. 관리자에게 문의하세요.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push('/teacher/dashboard');
  }

  return (
    <div className="container">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img src="/school-logo.png" alt="봉일천고등학교 로고" style={{ width: 56, height: 56 }} />
        </div>
        <h2 style={{ textAlign: 'center' }}>선생님 로그인</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
        <p style={{ marginTop: 16 }}>
          <a href="/" style={{ fontSize: 13, color: '#6b7280' }}>← 학생 화면으로 돌아가기</a>
        </p>
      </div>
    </div>
  );
}
