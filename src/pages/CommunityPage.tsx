import React, { useEffect, useState } from 'react';
import { Heart, MessageSquare, Pin, Send, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatArabicDate, ROLE_LABELS } from '../lib/labels';
import { useToast } from '../components/ToastProvider';
import type { Announcement, CommunityPost, UserProfile } from '../types/xo';

interface CommunityResponse {
  posts: CommunityPost[];
  announcements: Announcement[];
}

export const CommunityPage: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [titleAr, setTitleAr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [category, setCategory] = useState('عام');
  const [branchId, setBranchId] = useState<string>('all');
  const [posting, setPosting] = useState(false);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const loadCommunity = () => {
    setLoading(true);
    apiFetch<CommunityResponse>('/api/community')
      .then(setData)
      .catch(() => showToast('تعذر تحميل مجتمع الأكاديمية.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCommunity();
  }, [user.id]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      await apiFetch('/api/community/posts', {
        method: 'POST',
        body: JSON.stringify({
          titleAr,
          bodyAr,
          category,
          branchId: branchId === 'all' ? null : branchId,
        }),
      });
      setTitleAr('');
      setBodyAr('');
      showToast(
        user.role === 'PARENT'
          ? 'تم إرسال مشاركتك للمراجعة من إدارة الأكاديمية.'
          : 'تم نشر المشاركة بنجاح.',
        'success',
      );
      loadCommunity();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر النشر.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await apiFetch(`/api/community/posts/${postId}/like`, { method: 'POST' });
      loadCommunity();
    } catch {
      showToast('تعذر تحديث الإعجاب.', 'error');
    }
  };

  const handleComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;
    try {
      await apiFetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ bodyAr: text }),
      });
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      loadCommunity();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إضافة التعليق.', 'error');
    }
  };

  const handleModerate = async (postId: string, patch: { isApproved?: boolean; isPinned?: boolean }) => {
    try {
      await apiFetch(`/api/community/posts/${postId}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      showToast('تم تحديث حالة المنشور.', 'success');
      loadCommunity();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'غير مصرح بالإشراف.', 'error');
    }
  };

  const canModerate =
    user.role === 'OWNER' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_community'));

  if (loading || !data) {
    return <div className="h-64 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-extrabold text-white">
          XO COMMUNITY — مجتمع الأكاديمية
        </h2>
        <p className="text-sm text-[#94A3B8] mt-1">
          تواصل آمن بإشراف إداري بين المدربين وأولياء الأمور والأبطال
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Role-based posting box */}
          {user.role !== 'PLAYER' ? (
            <form
              onSubmit={handlePublish}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4"
            >
              <h3 className="font-display text-base font-bold text-white">مشاركة جديدة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  minLength={3}
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="عنوان المشاركة..."
                  className="sm:col-span-2 rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B1A]"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                >
                  <option value="عام">عام</option>
                  <option value="إنجازات">إنجازات</option>
                  <option value="نصائح فنية">نصائح فنية</option>
                </select>
              </div>
              <textarea
                rows={3}
                required
                minLength={5}
                value={bodyAr}
                onChange={(e) => setBodyAr(e.target.value)}
                placeholder="اكتب رسالتك لمجتمع XO Sport Academy..."
                className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF6B1A]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-xs text-white"
                >
                  <option value="all">لكل الفروع</option>
                  <option value="branch_gamal">ميامي — جمال عبد الناصر</option>
                  <option value="branch_khalil">ميامي — خليل حمادة</option>
                </select>
                <button
                  type="submit"
                  disabled={posting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>{posting ? 'جاري النشر...' : 'نشر'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-4 flex items-center gap-3 text-xs text-[#94A3B8]">
              <ShieldCheck className="w-4 h-4 text-[#FF6B1A] shrink-0" />
              <span>يمكن للاعبين التفاعل بالإعجاب والتعليق تحت إشراف إدارة الأكاديمية.</span>
            </div>
          )}

          {/* Posts Feed */}
          <div className="space-y-4">
            {data.posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                      <span className="text-white font-semibold">{post.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#FF6B1A]">{ROLE_LABELS[post.authorRole]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{formatArabicDate(post.createdAt)}</span>
                      {post.isPinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#FF6B1A] font-semibold">مثبت</span>
                        </>
                      )}
                      {!post.isApproved && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400 font-semibold">بانتظار الاعتماد</span>
                        </>
                      )}
                    </div>
                    <h4 className="font-display text-lg font-bold text-white">{post.titleAr}</h4>
                  </div>

                  {canModerate && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!post.isApproved && (
                        <button
                          type="button"
                          onClick={() => handleModerate(post.id, { isApproved: true })}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25"
                        >
                          اعتماد
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleModerate(post.id, { isPinned: !post.isPinned })}
                        className="p-2 rounded-lg border border-white/[0.1] text-[#94A3B8] hover:text-white"
                        title="تثبيت / إلغاء التثبيت"
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-[#CBD5E1] leading-relaxed">{post.bodyAr}</p>

                <div className="pt-3 border-t border-white/[0.06] flex items-center gap-6 text-xs text-[#94A3B8]">
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 py-1.5 transition-colors ${
                      post.likedByMe ? 'text-[#FF6B1A] font-semibold' : 'hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-[#FF6B1A]' : ''}`} />
                    <span className="font-mono-num">{post.likesCount}</span>
                    <span>إعجاب</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-mono-num">{post.comments.length}</span>
                    <span>تعليقات</span>
                  </div>
                </div>

                {/* Comments */}
                {post.comments.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
                    {post.comments.map((cmt) => (
                      <div key={cmt.id} className="text-xs space-y-0.5">
                        <div className="text-[#94A3B8]">
                          <span className="text-white font-semibold">{cmt.authorName}</span> ·{' '}
                          <span>{ROLE_LABELS[cmt.authorRole]}</span>
                        </div>
                        <p className="text-[#CBD5E1]">{cmt.bodyAr}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={commentInputs[post.id] || ''}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                    }
                    placeholder="أضف تعليقاً..."
                    className="flex-1 rounded-xl bg-[#080D18] border border-white/[0.1] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FF6B1A]"
                  />
                  <button
                    type="button"
                    onClick={() => handleComment(post.id)}
                    className="px-4 py-2 rounded-xl bg-[#080D18] border border-white/[0.1] text-xs font-semibold text-white hover:border-[#FF6B1A]"
                  >
                    إرسال
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Official Announcements Sidebar */}
        <aside className="lg:col-span-4 rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-white">التنبيهات الرسمية</h3>
          <div className="divide-y divide-white/[0.06]">
            {data.announcements.map((ann) => (
              <div key={ann.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                <div className="text-xs text-[#FF6B1A] font-medium">
                  {formatArabicDate(ann.createdAt)} · {ann.authorName}
                </div>
                <h4 className="text-sm font-bold text-white">{ann.titleAr}</h4>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{ann.bodyAr}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
