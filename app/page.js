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
  if (dday <= 21) {
    return <span className="badge badge-warn">D-{dday}</span>;
  }
  return <span className="badge badge-warn">D-{dday}</span>;
}

export default function StudentPage() {
  const [items, setItems] = useState([]);
  const [notices, setNotices] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [{ data: itemData }, { data: noticeData }, { data: infoData }] = await Promise.all([
        supabase.from('lost_items').select('*').order('created_at', { ascending: false }),
        supabase.from('notices').select('*').order('created_at', { ascending: false }),
        supabase.from('school_info').select('*').eq('id', 1).single(),
      ]);
      if (!mounted) return;
      setItems(itemData || []);
      setNotices(noticeData || []);
      setSchoolInfo(infoData?.content || '');
      setLoading(false);
    }
    load();

    // 실시간 구독: 다른 사용자가 등록/수정/삭제하면 새로고침 없이 즉시 반영됨
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
          <a href="/admin/login">관리자 로그인</a>
        </div>
      </div>

      <div className="hero-banner">
        <img src="/school-building.jpg" alt="봉일천고등학교 전경" />
        <div className="hero-text">잃어버린 물건, 여기서 찾아보세요</div>
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

        <h2 style={{ fontSize: 16, marginTop: 24 }}>습득된 분실물 목록</h2>

        {loading ? (
          <p className="empty-text">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="empty-text">등록된 분실물이 없습니다.</p>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <div className="card" key={item.id}>
                {item.photo_url && <img src={item.photo_url} alt={item.title} />}
                <div className="card-body">
                  <div className="card-title">{item.title}</div>
                  <div className="card-meta">
                    📍 {item.location} · 습득일 {item.found_date}
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
      </div>
    </div>
  );
}
