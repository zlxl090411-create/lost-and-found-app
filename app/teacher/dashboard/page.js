'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function TeacherDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', location: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 학교 정보 및 공지사항 상태
  const [schoolInfo, setSchoolInfo] = useState({ id: null, info_text: '', contact: '' });
  const [notice, setNotice] = useState({ id: null, content: '' });
  const [infoMessage, setInfoMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const loadItems = async () => {
    const { data } = await supabase
      .from('lost_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems(data || []);
  };

  const loadSchoolAndNotice = async () => {
    const { data: schoolData } = await supabase.from('school_info').select('*').limit(1).maybeSingle();
    if (schoolData) {
      setSchoolInfo(schoolData);
    }

    const { data: noticeData } = await supabase.from('notices').select('*').limit(1).maybeSingle();
    if (noticeData) {
      setNotice(noticeData);
    }
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
      loadSchoolAndNotice();
    }
    checkAuth();

    const channel = supabase
      .channel('teacher:lost_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, () => loadItems())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

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

  async function handleUpdateSchoolInfo(e) {
    e.preventDefault();
    if (schoolInfo.id) {
      const { error } = await supabase
        .from('school_info')
        .update({ info_text: schoolInfo.info_text, contact: schoolInfo.contact })
        .eq('id', schoolInfo.id);
      if (error) setInfoMessage('학교 정보 수정 실패: ' + error.message);
      else setInfoMessage('학교 정보가 수정되었습니다.');
    } else {
      const { data, error } = await supabase
        .from('school_info')
        .insert({ info_text: schoolInfo.info_text, contact: schoolInfo.contact })
        .select()
        .maybeSingle();
      if (error) setInfoMessage('학교 정보 저장 실패: ' + error.message);
      else if (data) {
        setSchoolInfo(data);
        setInfoMessage('학교 정보가 저장되었습니다.');
      }
    }
  }

  async function handleUpdateNotice(e) {
    e.preventDefault();
    if (notice.id) {
      const { error } = await supabase
        .from('notices')
        .update({ content: notice.content })
        .eq('id', notice.id);
      if (error) setNoticeMessage('공지사항 수정 실패: ' + error.message);
      else setNoticeMessage('공지사항이 수정되었습니다.');
    } else {
      const { data, error } = await supabase
        .from('notices')
        .insert({ content: notice.content })
        .select()
        .maybeSingle();
      if (error) setNoticeMessage('공지사항 저장 실패: ' + error.message);
      else if (data) {
        setNotice(data);
        setNoticeMessage('공지사항이 등록되었습니다.');
      }
    }
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

  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const titleMatch = item.title?.toLowerCase().includes(query);
    const locationMatch = item.location?.toLowerCase().includes(query);
    const descMatch = item.description?.toLowerCase().includes(query);
    return titleMatch || locationMatch || descMatch;
  });

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

        {/* 학교 정보 및 공지사항 관리 섹션 */}
        <div style={{ marginTop: '40px', borderTop: '2px solid #e5e8ef', paddingTop: '24px' }}>
          <h2 style={{ fontSize: 18, marginBottom: '16px' }}>⚙️ 학교 정보 및 공지사항 관리</h2>

          <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef', marginBottom: '20px' }}>
            <h3 style={{ fontSize: 15, marginBottom: '12px' }}>학교 정보 수정</h3>
            <form onSubmit={handleUpdateSchoolInfo}>
              <div className="form-group">
                <label>위치 및 안내 텍스트</label>
                <input 
                  type="text" 
                  value={schoolInfo.info_text || ''} 
                  onChange={(e) => setSchoolInfo({ ...schoolInfo, info_text: e.target.value })} 
                  placeholder="예: 행정실(1층) 등"
                />
              </div>
              <div className="form-group">
                <label>연락처 및 운영 시간</label>
                <input 
                  type="text" 
                  value={schoolInfo.contact || ''} 
                  onChange={(e) => setSchoolInfo({ ...schoolInfo, contact: e.target.value })} 
                  placeholder="예: 행정실 031-945-0857 (평일 9:00-17:00)"
                />
              </div>
              <button className="btn btn-sm" type="submit">학교 정보 저장</button>
              {infoMessage && <p style={{ fontSize: 13, marginTop: 8, color: '#2563eb' }}>{infoMessage}</p>}
            </form>
          </div>

          <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e8ef' }}>
            <h3 style={{ fontSize: 15, marginBottom: '12px' }}>공지사항 수정</h3>
            <form onSubmit={handleUpdateNotice}>
              <div className="form-group">
                <label>공지사항 내용</label>
                <textarea 
                  rows={3} 
                  value={notice.content || ''} 
                  onChange={(e) => setNotice({ ...notice, content: e.target.value })} 
                  placeholder="학생들에게 공지할 내용을 입력하세요."
                />
              </div>
              <button className="btn btn-sm" type="submit">공지사항 저장</button>
              {noticeMessage && <p style={{ fontSize: 13, marginTop: 8, color: '#2563eb' }}>{noticeMessage}</p>}
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
