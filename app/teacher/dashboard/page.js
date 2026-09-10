'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function TeacherDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', location: '', found_date: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/teacher/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (!profile || profile.role !== 'teacher') {
        router.push('/teacher/login');
        return;
      }
      setChecking(false);
      loadItems();
    }
    checkAuth();

    const channel = supabase
      .channel('teacher:lost_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, () => loadItems())
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadItems() {
    const { data } = await supabase.from('lost_items').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    let photo_url = null;
    if (photoFile) {
      const fileName = `${Date.now()}_${photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('lost-item-photos')
        .upload(fileName, photoFile);
      if (uploadError) {
        setMessage('사진 업로드 실패: ' + uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('lost-item-photos').getPublicUrl(fileName);
      photo_url = urlData.publicUrl;
    }

    const { data: { session } } = await supabase.auth.getSession();

    const { error: insertError } = await supabase.from('lost_items').insert({
      title: form.title,
      description: form.description,
      location: form.location,
      found_date: form.found_date,
      photo_url,
      created_by: session.user.id,
    });

    if (insertError) {
      setMessage('등록 실패: ' + insertError.message);
    } else {
      setMessage('등록되었습니다.');
      setForm({ title: '', description: '', location: '', found_date: '' });
      setPhotoFile(null);
    }
    setSubmitting(false);
  }

  async function markAsFound(id) {
    await supabase.from('lost_items').update({ status: 'claimed', updated_at: new Date().toISOString() }).eq('id', id);
  }

  async function deleteItem(id) {
    if (!confirm('이 분실물을 삭제할까요?')) return;
    await supabase.from('lost_items').delete().eq('id', id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (checking) return <p className="empty-text">확인 중...</p>;

  return (
    <div>
      <div className="header">
        <div className="header-brand">
          <img src="/school-logo.png" alt="봉일천고등학교 로고" />
          <div>
            <h1>선생님 화면</h1>
            <div className="subtitle">봉일천고등학교 분실물 게시판</div>
          </div>
        </div>
        <div className="links">
          <a href="/">학생 화면 보기</a>
          <button className="btn btn-outline btn-sm" onClick={handleLogout} style={{ marginLeft: 12 }}>
            로그아웃
          </button>
        </div>
      </div>

      <div className="container">
        <h2 style={{ fontSize: 16 }}>분실물 등록</h2>
        <form onSubmit={handleSubmit} style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef' }}>
          <div className="form-group">
            <label>제목</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>습득 장소</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>습득 날짜</label>
            <input type="date" value={form.found_date} onChange={(e) => setForm({ ...form, found_date: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>설명</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label>사진 (선택)</label>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '등록 중...' : '등록하기'}
          </button>
          {message && <p style={{ fontSize: 13, marginTop: 8 }}>{message}</p>}
        </form>

        <h2 style={{ fontSize: 16, marginTop: 28 }}>등록한 분실물 목록</h2>
        <div className="grid">
          {items.map((item) => (
            <div className="card" key={item.id}>
              {item.photo_url && <img src={item.photo_url} alt={item.title} />}
              <div className="card-body">
                <div className="card-title">{item.title}</div>
                <div className="card-meta">📍 {item.location} · {item.found_date}</div>
                <div style={{ marginTop: 6 }}>
                  {item.status === 'claimed' ? (
                    <span className="badge badge-done">주인 찾음</span>
                  ) : (
                    <span className="badge badge-warn">미해결</span>
                  )}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  {item.status !== 'claimed' && (
                    <button className="btn btn-sm" onClick={() => markAsFound(item.id)}>
                      찾았어요 표시
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => deleteItem(item.id)}>
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
