'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function StudentHome() {
  const [items, setItems] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState({ info_text: '', contact: '' });
  const [notices, setNotices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const loadData = async () => {
    const { data: itemData } = await supabase
      .from('lost_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems(itemData || []);

    const { data: schoolData } = await supabase.from('school_info').select('*').limit(1).maybeSingle();
    if (schoolData) setSchoolInfo(schoolData);

    const { data: noticeData } = await supabase.from('notices').select('*');
    if (noticeData) setNotices(noticeData);
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('public:lost_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  return (
    <div>
      <div className="header">
        <div className="header-brand">
          <img src="/school-logo.png" alt="봉일천고등학교 로고" />
          <div>
            <h1>봉일천고등학교 분실물 센터</h1>
            <div className="subtitle">잃어버린 물건을 찾아가세요</div>
          </div>
        </div>
        <div className="links">
          <a href="/teacher/login" className="btn btn-outline btn-sm">
            선생님 로그인
          </a>
        </div>
      </div>

      <div className="container">
        {notices.length > 0 && (
          <div style={{ marginBottom: 24, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, marginBottom: 8, color: '#1e293b' }}>📢 공지사항</h3>
            {notices.map((n) => (
              <p key={n.id} style={{ fontSize: 14, color: '#475569', whiteSpace: 'pre-wrap', margin: 0 }}>
                {n.content}
              </p>
            ))}
          </div>
        )}

        {schoolInfo.info_text && (
          <div style={{ background: '#eff6ff', padding: 16, borderRadius: 12, border: '1px solid #bfdbfe', marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 6, color: '#1e40af' }}>🏫 분실물 수령 안내</h3>
            <p style={{ fontSize: 14, color: '#1e3a8a', margin: 0 }}>{schoolInfo.info_text}</p>
            {schoolInfo.contact && (
              <p style={{ fontSize: 13, color: '#3b82f6', marginTop: 4, margin: 0 }}>연락처: {schoolInfo.contact}</p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>분실물 목록</h2>
          <input
            type="text"
            placeholder="제목, 장소, 설명 검색..."
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
          <p className="empty-text">등록된 분실물이 없습니다.</p>
        ) : (
          <div className="grid">
            {filteredItems.map((item) => (
              <div className="card" key={item.id}>
                {item.photo_url && (
                  <img
                    src={item.photo_url}
                    alt={item.title}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedImage(item.photo_url)}
                  />
                )}
                <div className="card-body">
                  <div className="card-title">{item.title}</div>
                  <div className="card-meta">📍 {item.location} · {formatDate(item.created_at || item.found_date)}</div>
                  {item.description && <p style={{ fontSize: 14, color: '#666', marginTop: 6 }}>{item.description}</p>}
                  <div style={{ marginTop: 10 }}>
                    {item.status === 'claimed' ? (
                      <span className="badge badge-done">주인 찾음</span>
                    ) : (
                      <span className="badge badge-warn">보관 중</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="확대 이미지" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
