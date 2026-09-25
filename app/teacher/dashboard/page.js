'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function TeacherDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', location: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [notices, setNotices] = useState([]);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '' });
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [schoolInfo, setSchoolInfo] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const loadItems = async () => {
    const { data } = await supabase
      .from('lost_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems(data || []);
  };

  const loadNoticesAndInfo = async () => {
    const { data: noticeData } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    setNotices(noticeData || []);

    const { data: infoData } = await supabase
      .from('school_info')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    setSchoolInfo(infoData?.content || '');
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: authData } = await supabase.auth.getSession();
      const session = authData?.session;
      if (!session) {
        router.push('/teacher/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
        router.push('/teacher/login');
        return;
      }
      setChecking(false);
      loadItems();
      loadNoticesAndInfo();
    }
    checkAuth();

    const itemsChannel = supabase
      .channel('teacher:lost_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, () => loadItems())
      .subscribe();
    const noticesChannel = supabase
      .channel('teacher:notices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => loadNoticesAndInfo())
      .subscribe();
    const infoChannel = supabase
      .channel('teacher:school_info')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_info' }, () => loadNoticesAndInfo())
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(noticesChannel);
      supabase.removeChannel(infoChannel);
    };
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    let photo_url = null;
    if (photoFile) {
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
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

    const { data: authData } = await supabase.auth.getSession();
    const session = authData?.session;
    const todayStr = new Date().toISOString().split('T')[0];

    const { error: insertError } = await supabase.from('lost_items').insert({
      title: form.title,
      description: form.description,
      location: form.location,
      found_date: todayStr,
      photo_url,
      created_by: session?.user?.id,
    });

    if (insertError) {
      setMessage('등록 실패: ' + insertError.message);
    } else {
      setMessage('등록되었습니다.');
      setForm({ title: '', description: '', location: '' });
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

  async function handleNoticeSubmit(e) {
    e.preventDefault();
    setNoticeMessage('');
    const { data: authData } = await supabase.auth.getSession();
    const session = authData?.session;

    let result;
    if (editingNoticeId) {
      result = await supabase
        .from('notices')
        .update({ title: noticeForm.title, content: noticeForm.content, updated_at: new Date().toISOString() })
        .eq('id', editingNoticeId);
      setEditingNoticeId(null);
    } else {
      result = await supabase.from('notices').insert({
        title: noticeForm.title,
        content: noticeForm.content,
        created_by: session?.user?.id,
      });
    }

    if (result.error) {
      setNoticeMessage('공지사항 저장 실패: ' + result.error.message);
      return;
    }
    setNoticeForm({ title: '', content: '' });
    setNoticeMessage('저장되었습니다.');
    loadNoticesAndInfo();
  }

  function startEditNotice(n) {
    setEditingNoticeId(n.id);
    setNoticeForm({ title: n.title, content: n.content });
  }

  async function deleteNotice(id) {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) {
      setNoticeMessage('삭제 실패: ' + error.message);
      return;
    }
    loadNoticesAndInfo();
  }

  async function saveSchoolInfo() {
    setInfoMessage('');
    const { error } = await supabase
      .from('school_info')
      .update({ content: schoolInfo, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) {
      setInfoMessage('학교 정보 저장 실패: ' + error.message);
      return;
    }
    setInfoMessage('저장되었습니다.');
    setTimeout(() => setInfoMessage(''), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

    const filteredItems = items
    .filter((item) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      const titleMatch = item.title?.toLowerCase().includes(query);
      const locationMatch = item.location?.toLowerCase().includes(query);
      const descMatch = item.description?.toLowerCase().includes(query);
      return titleMatch || locationMatch || descMatch;
    })
    .sort((a, b) => (a.status === 'claimed') - (b.status === 'claimed'));
  if (checking) return <p className="empty-text">확인 중...</p>;

  return (
    <div>
      <div className="header">
        <div className="header-brand">
          <img src="/school-logo.png" alt="봉일천고등학교 로고" />
          <div>
            <h1>선생님 / 관리자 화면</h1>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>등록한 분실물 목록</h2>
          <input
            type="text"
            placeholder="제목, 장소, 설명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 14px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              width: '100%',
              maxWidth: '260px',
              outline: 'none'
            }}
          />
        </div>

        {filteredItems.length === 0 ? (
          <p className="empty-text" style={{ marginTop: 16 }}>
            {searchQuery ? '검색 결과에 해당하는 분실물이 없습니다.' : '등록된 분실물이 없습니다.'}
          </p>
        ) : (
          <div className="grid" style={{ marginTop: 16 }}>
            {filteredItems.map((item) => (
              <div className="card" key={item.id}>
                {item.photo_url && <img src={item.photo_url} alt={item.title} />}
                <div className="card-body">
                  <div className="card-title">{item.title}</div>
                  <div className="card-meta">📍 {item.location} · 등록일 {formatDate(item.created_at || item.found_date)}</div>
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
        )}

        <div style={{ marginTop: '40px', borderTop: '2px solid #e5e8ef', paddingTop: '24px' }}>
          <h2 style={{ fontSize: 18, marginBottom: '16px' }}>⚙️ 학교 정보 및 공지사항 관리</h2>

          <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef', marginBottom: '20px' }}>
            <h3 style={{ fontSize: 15, marginBottom: '12px' }}>공지사항 {editingNoticeId ? '수정' : '등록'}</h3>
            <form onSubmit={handleNoticeSubmit}>
              <div className="form-group">
                <label>제목</label>
                <input
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>내용</label>
                <textarea
                  rows={3}
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  required
                />
              </div>
              <button className="btn btn-sm" type="submit">{editingNoticeId ? '수정 완료' : '등록하기'}</button>
              {editingNoticeId && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => { setEditingNoticeId(null); setNoticeForm({ title: '', content: '' }); }}
                >
                  취소
                </button>
              )}
              {noticeMessage && <p style={{ fontSize: 13, marginTop: 8, color: '#2563eb' }}>{noticeMessage}</p>}
            </form>

            <div style={{ marginTop: 14 }}>
              {notices.map((n) => (
                <div key={n.id} style={{ border: '1px solid #e5e8ef', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <strong>{n.title}</strong>
                  <p style={{ fontSize: 13, margin: '4px 0' }}>{n.content}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => startEditNotice(n)}>수정</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteNotice(n.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef' }}>
            <h3 style={{ fontSize: 15, marginBottom: '12px' }}>학교 정보 수정</h3>
            <textarea
              rows={5}
              value={schoolInfo}
              onChange={(e) => setSchoolInfo(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid #e5e8ef', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
            />
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={saveSchoolInfo}>저장</button>
            {infoMessage && <span style={{ marginLeft: 10, fontSize: 13, color: '#2563eb' }}>{infoMessage}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
