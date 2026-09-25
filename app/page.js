'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const DISPOSAL_DAYS = 90;

function getDday(foundDate) {
  const found = new Date(foundDate);
  const deadline = new Date(found);
  deadline.setDate(deadline.getDate() + DISPOSAL_DAYS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24));
  return diffDays;
}

function DdayBadge({ status, foundDate }) {
  if (status === 'claimed') {
    return <span className="badge badge-done">주인 찾음</span>;
  }
  const dday = getDday(foundDate);
  if (dday < 0) {
    return <span className="badge badge-danger">폐기 대상</span>;
  }
  if (dday <= 7) {
    return <span className="badge badge-danger">D-{dday} (폐기 임박)</span>;
  }
  return <span className="badge badge-warn">D-{dday}</span>;
}

export default function StudentPage() {
  const [items, setItems] = useState([]);
  const [notices, setNotices] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [{ data: itemData }, { data: noticeData }, { data: infoData }] = await Promise.all([
        supabase.from('lost_items').select('*').order('created_at', { ascending: false }),
        supabase.from('notices').select('*').order('created_at', { ascending: false }),
        supabase.from('school_info').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (!mounted) return;
      setItems(itemData || []);
      setNotices(noticeData || []);
      setSchoolInfo(infoData?.content || '');
      setLoading(false);
    }
    load();

    const itemsChannel = supabase
      .channel('public:lost_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, () => load())
      .subscribe();

    const noticesChannel = supabase
      .channel('public:notices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => load())
      .subscribe();

    const infoChannel = supabase
      .channel('public:school_info')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_info' }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(noticesChannel);
      supabase.removeChannel(infoChannel);
    };
  }, []);

  function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

    const filteredItems = items
    .filter((item) => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        item.title?.toLowerCase().includes(term) ||
        item.location?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term)
      );
    })
ㄴems = filteredItems.filter((item) => item.status === 'claimed');
    .sort((a, b) => (a.status === 'claimed') - (b.status === 'claimed'));
  return (
    <div>
      <div className="header">
        <div className="header-brand">
          <img src="/school-logo.png" alt="봉일천고등학교 로고" />
          <div>
            <h1>봉일천고등학교</h1>
            <div className="subtitle">분실물 게시판</div>
          </div>
        </div>
        <div className="links">
          <a href="/teacher/login">선생님 로그인</a>
        </div>
      </div>

      <div className="hero-banner">
        <img src="/school-building.jpg" alt="봉일천고등학교 전경" />
        <div className="hero-text">
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.85, marginBottom: 2 }}>
            MADE IN MAKERS (SDY)
          </div>
          잃어버린 물건, 여기서 찾아보세요
        </div>
      </div>

      <div className="container">
        {notices.length > 0 && (
          <div className="notice-box">
            <h3>📢 공지사항</h3>
            {notices.map((n) => (
              <div className="notice-item" key={n.id}>
                <strong>{n.title}</strong>
                <div style={{ fontSize: 13, color: '#444', marginTop: 2 }}>{n.content}</div>
              </div>
            ))}
          </div>
        )}

        {schoolInfo && (
          <div className="notice-box" style={{ background: '#f8f9fb', border: '1px solid #e5e8ef' }}>
            <h3 style={{ color: '#1c1f26' }}>🏫 학교 정보</h3>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{schoolInfo}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>습득된 분실물 목록</h2>
          <input
            type="text"
            placeholder="🔍 제목, 장소, 설명으로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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

               {loading ? (
          <p className="empty-text">불러오는 중...</p>
        ) : filteredItems.length === 0 ? (
          <p className="empty-text">{searchTerm ? '검색 결과가 없습니다.' : '등록된 분실물이 없습니다.'}</p>
        ) : (
          <>
            {unclaimedItems.length === 0 ? (
              <p className="empty-text">미해결 분실물이 없습니다.</p>
            ) : (
              <div className="grid">
                {unclaimedItems.map((item) => (
                  <div className="card" key={item.id} onClick={() => setSelectedItem(item)}>
                    {item.photo_url && <img src={item.photo_url} alt={item.title} />}
                    <div className="card-body">
                      <div className="card-title">{item.title}</div>
                      <div className="card-meta">
                        📍 {item.location} · 등록일 {formatDate(item.created_at || item.found_date)}
                      </div>
                      {item.description && <div className="card-desc">{item.description}</div>}
                      <div style={{ marginTop: 6 }}>
                        <DdayBadge status={item.status} foundDate={item.found_date} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {claimedItems.length > 0 && (
              <>
                <h2 style={{ fontSize: 16, marginTop: 28 }}>주인 찾은 분실물</h2>
                <div className="grid">
                  {claimedItems.map((item) => (
                    <div className="card" key={item.id} onClick={() => setSelectedItem(item)} style={{ opacity: 0.7 }}>
                      {item.photo_url && <img src={item.photo_url} alt={item.title} />}
                      <div className="card-body">
                        <div className="card-title">{item.title}</div>
                        <div className="card-meta">
                          📍 {item.location} · 등록일 {formatDate(item.created_at || item.found_date)}
                        </div>
                        {item.description && <div className="card-desc">{item.description}</div>}
                        <div style={{ marginTop: 6 }}>
                          <DdayBadge status={item.status} foundDate={item.found_date} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedItem(null)}>✕</button>
            {selectedItem.photo_url && <img src={selectedItem.photo_url} alt={selectedItem.title} />}
            <div className="modal-body">
              <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{selectedItem.title}</h2>
              <div className="card-meta">
                📍 {selectedItem.location} · 등록일 {formatDate(selectedItem.created_at || selectedItem.found_date)}
              </div>
              {selectedItem.description && (
                <p style={{ fontSize: 14, marginTop: 10, whiteSpace: 'pre-wrap' }}>{selectedItem.description}</p>
              )}
              <div style={{ marginTop: 12 }}>
                <DdayBadge status={selectedItem.status} foundDate={selectedItem.found_date} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
