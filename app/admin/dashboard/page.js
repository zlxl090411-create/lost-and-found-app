'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [notices, setNotices] = useState([]);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '' });
  const [editingId, setEditingId] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (!profile || profile.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
      setChecking(false);
      loadData();
    }
    checkAuth();

    const noticeChannel = supabase
      .channel('admin:notices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => loadData())
      .subscribe();
    const infoChannel = supabase
      .channel('admin:school_info')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_info' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(noticeChannel);
      supabase.removeChannel(infoChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const [{ data: noticeData }, { data: infoData }] = await Promise.all([
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
      supabase.from('school_info').select('*').eq('id', 1).single(),
    ]);
    setNotices(noticeData || []);
    setSchoolInfo(infoData?.content || '');
  }

  async function handleNoticeSubmit(e) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();

    if (editingId) {
      await supabase
        .from('notices')
        .update({ title: noticeForm.title, content: noticeForm.content, updated_at: new Date().toISOString() })
        .eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('notices').insert({
        title: noticeForm.title,
        content: noticeForm.content,
        created_by: session.user.id,
      });
    }
    setNoticeForm({ title: '', content: '' });
  }

  function startEdit(notice) {
    setEditingId(notice.id);
    setNoticeForm({ title: notice.title, content: notice.content });
  }

  async function deleteNotice(id) {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    await supabase.from('notices').delete().eq('id', id);
  }

  async function saveSchoolInfo() {
    await supabase.from('school_info').update({ content: schoolInfo, updated_at: new Date().toISOString() }).eq('id', 1);
    setMessage('학교 정보가 저장되었습니다.');
    setTimeout(() => setMessage(''), 2000);
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
            <h1>관리자 화면</h1>
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
        <h2 style={{ fontSize: 16 }}>공지사항 {editingId ? '수정' : '등록'}</h2>
        <form onSubmit={handleNoticeSubmit} style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef' }}>
          <div className="form-group">
            <label>제목</label>
            <input value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>내용</label>
            <textarea rows={3} value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} required />
          </div>
          <button className="btn" type="submit">{editingId ? '수정 완료' : '등록하기'}</button>
          {editingId && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginLeft: 8 }}
              onClick={() => { setEditingId(null); setNoticeForm({ title: '', content: '' }); }}
            >
              취소
            </button>
          )}
        </form>

        <div style={{ marginTop: 16 }}>
          {notices.map((n) => (
            <div key={n.id} style={{ background: 'white', border: '1px solid #e5e8ef', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <strong>{n.title}</strong>
              <p style={{ fontSize: 13, margin: '4px 0' }}>{n.content}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => startEdit(n)}>수정</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteNotice(n.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 16, marginTop: 28 }}>학교 정보 수정</h2>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef' }}>
          <textarea
            rows={5}
            value={schoolInfo}
            onChange={(e) => setSchoolInfo(e.target.value)}
            style={{ width: '100%', padding: 10, border: '1px solid #e5e8ef', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
          />
          <button className="btn" style={{ marginTop: 10 }} onClick={saveSchoolInfo}>저장</button>
          {message && <span style={{ marginLeft: 10, fontSize: 13, color: '#1f9d55' }}>{message}</span>}
        </div>
      </div>
    </div>
  );
}
