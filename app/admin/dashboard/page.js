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
  const [items, setItems] = useState([]);
  const [teacherMap, setTeacherMap] = useState({});

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
    const itemsChannel = supabase
      .channel('admin:lost_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(noticeChannel);
      supabase.removeChannel(infoChannel);
      supabase.removeChannel(itemsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const [{ data: noticeData, error: e1 }, { data: infoData, error: e2 }, { data: itemData, error: e3 }] = await Promise.all([
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
      supabase.from('school_info').select('*').eq('id', 1).single(),
      supabase.from('lost_items').select('*').order('created_at', { ascending: false }),
    ]);
    if (e1) console.error('공지 불러오기 오류:', e1);
    if (e2) console.error('학교정보 불러오기 오류:', e2);
    if (e3) console.error('분실물 불러오기 오류:', e3);
    setNotices(noticeData || []);
    setSchoolInfo(infoData?.content || '');
    setItems(itemData || []);

    const teacherIds = [...new Set((itemData || []).map((i) => i.created_by).filter(Boolean))];
    if (teacherIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', teacherIds);
      const map = {};
      (profilesData || []).forEach((p) => { map[p.id] = p.email; });
      setTeacherMap(map);
    }
  }

  async function handleNoticeSubmit(e) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();

    let result;
    if (editingId) {
      result = await supabase
        .from('notices')
        .update({ title: noticeForm.title, content: noticeForm.content, updated_at: new Date().toISOString() })
        .eq('id', editingId);
      setEditingId(null);
    } else {
      result = await supabase.from('notices').insert({
        title: noticeForm.title,
        content: noticeForm.content,
        created_by: session.user.id,
      });
    }

    if (result.error) {
      alert('공지사항 저장 실패: ' + result.error.message);
      return;
    }

    setNoticeForm({ title: '', content: '' });
    loadData();
  }

  function startEdit(notice) {
    setEditingId(notice.id);
    setNoticeForm({ title: notice.title, content: notice.content });
  }

  async function deleteNotice(id) {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    loadData();
  }

  async function saveSchoolInfo() {
    const { error } = await supabase
      .from('school_info')
      .update({ content: schoolInfo, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) {
      alert('학교 정보 저장 실패: ' + error.message);
      return;
    }
    setMessage('학교 정보가 저장되었습니다.');
    setTimeout(() => setMessage(''), 2000);
    loadData();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
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

        <h2 style={{ fontSize: 16, marginTop: 28 }}>분실물 등록 현황</h2>
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e8ef', overflow: 'hidden' }}>
          {items.length === 0 ? (
            <p className="empty-text">등록된 분실물이 없습니다.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>제목</th>
                  <th style={{ padding: '10px 12px' }}>등록한 선생님</th>
                  <th style={{ padding: '10px 12px' }}>등록 시간</th>
                  <th style={{ padding: '10px 12px' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #e5e8ef' }}>
                    <td style={{ padding: '10px 12px' }}>{item.title}</td>
                    <td style={{ padding: '10px 12px' }}>{teacherMap[item.created_by] || '알 수 없음'}</td>
                    <td style={{ padding: '10px 12px' }}>{formatDateTime(item.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {item.status === 'claimed' ? (
                        <span className="badge badge-done">주인 찾음</span>
                      ) : (
                        <span className="badge badge-warn">미해결</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
